const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe key not configured' });
  }

  const stripe = new Stripe(secretKey);

  try {
    const { items, clientName, clientEmail, websiteTier } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items selected' });
    }

    const catalog = {
      website: {
        html: {
          name: 'Local SEO Website - HTML + PHP (40 Pages)',
          price: 50000,
          description: '40-page local SEO site with Schema markup, location pages, 30 days SEO support.',
        },
        cms: {
          name: 'Local SEO Website - Custom CMS / Next.js (40 Pages)',
          price: 97800,
          description: '40-page local SEO site with custom Next.js CMS, visual editor, blog, content management.',
        },
      },
      store: {
        name: 'Affiliate Fundraiser Store',
        price: 27500,
        description: 'E-commerce storefront with affiliate fundraiser system, Stripe checkout, commission tracking.',
      },
      email: {
        name: 'Private Email Platform',
        price: 75000,
        description: 'Self-hosted email marketing, 50k emails/mo via Amazon SES, template builder, analytics.',
      },
      support: {
        name: 'Priority Support Retainer',
        price: 7500,
        description: 'Monthly maintenance, server upkeep, priority email support.',
        recurring: true,
      },
    };

    const lineItems = [];
    let hasRecurring = false;

    for (const itemKey of items) {
      if (itemKey === 'website') {
        const tier = websiteTier === 'cms' ? 'cms' : 'html';
        const product = catalog.website[tier];
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: product.name, description: product.description },
            unit_amount: product.price,
          },
          quantity: 1,
        });
      } else if (itemKey === 'support') {
        hasRecurring = true;
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: catalog.support.name, description: catalog.support.description },
            unit_amount: catalog.support.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        });
      } else if (catalog[itemKey]) {
        const product = catalog[itemKey];
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: product.name, description: product.description },
            unit_amount: product.price,
          },
          quantity: 1,
        });
      }
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid items' });
    }

    // If mixing one-time + recurring, drop recurring and note it
    if (hasRecurring) {
      const oneTimeItems = lineItems.filter(function(li) { return !li.price_data.recurring; });
      if (oneTimeItems.length > 0) {
        // Can't mix modes - just do payment for one-time items
        var sessionParams = {
          mode: 'payment',
          line_items: oneTimeItems,
          success_url: (req.headers.origin || 'https://prowash-rosy.vercel.app') + '?payment=success',
          cancel_url: (req.headers.origin || 'https://prowash-rosy.vercel.app') + '?payment=cancelled',
          metadata: {
            client_name: clientName || '',
            proposal: 'Pro Wash Digital Growth Package',
            note: 'Support retainer ($75/mo) to be invoiced separately',
          },
        };
      } else {
        // Only recurring
        var sessionParams = {
          mode: 'subscription',
          line_items: lineItems,
          success_url: (req.headers.origin || 'https://prowash-rosy.vercel.app') + '?payment=success',
          cancel_url: (req.headers.origin || 'https://prowash-rosy.vercel.app') + '?payment=cancelled',
          metadata: {
            client_name: clientName || '',
            proposal: 'Pro Wash Digital Growth Package',
          },
        };
      }
    } else {
      var sessionParams = {
        mode: 'payment',
        line_items: lineItems,
        success_url: (req.headers.origin || 'https://prowash-rosy.vercel.app') + '?payment=success',
        cancel_url: (req.headers.origin || 'https://prowash-rosy.vercel.app') + '?payment=cancelled',
        metadata: {
          client_name: clientName || '',
          proposal: 'Pro Wash Digital Growth Package',
        },
      };
    }

    if (clientEmail) {
      sessionParams.customer_email = clientEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe error:', err.message, err.type, err.raw);
    return res.status(500).json({ error: err.message });
  }
};
