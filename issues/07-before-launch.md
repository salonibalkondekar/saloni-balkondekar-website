# 07. Before launch: facts, domain, deploy

## Confirm with Saloni

- Employer and start date of the SAP IBP role. The page names neither.
- That the bio is accurate in her words: "working in supply chain planning on SAP IBP",
  "internships at two AI startups", "I studied mechanical engineering at SGGSIE&T, Nanded".
- The favicon: an S-shaped route mark, with a drawn avatar kept as the alternative. Her pick.
- Whether she holds an SAP IBP certification; if so it belongs near the top.
- A current resume. The last one found is from December 2025 and predates SAP.

## Domain: recommendation for Saloni (decide 2026-11-16)

Both `salonib.com` and `saloni.md` were unregistered on 2026-11-15.

**Recommendation: `salonib.com`, registered by Saloni in her own Cloudflare account.**

| | `salonib.com` | `saloni.md` |
|---|---|---|
| Cost | about $10-11 a year, the same every year | one listing at about $32 a year; renewal price not confirmed |
| How it reads | neutral; "b" is her surname and echoes "IBP" | "MD" reads as medical doctor, or as a Markdown file to developers |
| Long term | `.com` pricing is regulated; every registrar sells it; easy to move | Moldova's country domain: one national registry sets price and rules |
| Said aloud | "saloni-b dot com" | "dot m-d" needs explaining each time |

Ownership: whoever's account registers the name owns it. It is her name and her career, so it
should sit in her account, under her email, with auto-renew on and two-factor login. A domain
bought by someone else can be transferred later, but new registrations are locked for 60 days.
`salonib` is not a brand anyone else trades under as far as a name search shows; no trademark
search was done.

Where to buy (prices from comparison articles, check the live checkout):

| Registrar | First year | Renewal | Notes |
|---|---|---|---|
| Cloudflare Registrar | about $10-11 | same | sold at wholesale cost, free WHOIS privacy, no upsells. Recommended |
| Porkbun | about $11 | same | flat price, friendly interface, free privacy |
| Spaceship | about $4-5 with a promo | about $10-11 | cheapest first year; saves about $6 once |
| Namecheap | promo price | about $18.50 | avoid: renewals cost the most |

The "$6" figure is a first-year promo. Over five years every good option costs about $50-55, so
choose on simplicity, not the first-year price.

## Publish and deploy, under Saloni's own accounts

The owner wants the push and the deploy done from her accounts, not his. The finished site is
staged but **not committed** on branch `improve-step-by-step` on her brother's laptop
(`git status` shows it). `issues/` is deliberately unstaged: keep these notes off the public repo.

1. Commit and push as Saloni. On that laptop, in the repo folder:
   ```sh
   git remote set-url origin https://github.com/salonibalkondekar/saloni-balkondekar-website.git
   gh auth login                      # sign in as salonibalkondekar in the browser
   git -c user.name="Saloni Balkondekar" -c user.email="<her GitHub email>" commit -m "Rebuild the page around a live painting"
   git push origin improve-step-by-step:main
   ```
   The first line also removes an access token that was embedded in the remote URL; revoke that
   token at github.com > Settings > Developer settings.
2. Sign in at vercel.com with her GitHub account. Add New > Project > import
   `saloni-balkondekar-website`.
3. On the configure screen: Framework Preset "Other", leave Build Command and Output Directory
   empty, Root Directory `./`. Deploy. Check the `*.vercel.app` address it gives.
4. Buy the domain (above). In Vercel: Project > Settings > Domains > add `salonib.com` and
   `www.salonib.com`. Vercel shows two DNS records (an A record for the apex, a CNAME for `www`);
   enter them in Cloudflare's DNS tab with the proxy switched off (grey cloud). HTTPS is issued
   automatically once they resolve.
5. Paste `https://salonib.com` into a LinkedIn or WhatsApp message to check the link preview.

Notes:

- `.vercelignore` keeps `issues/`, `Dockerfile` and `README.md` off the public site.
- The link preview is `og.png` (1200x630). `index.html` points to it and to the canonical URL at
  `https://salonib.com/`. If a different domain is bought, change those four URLs in the
  `<head>`. To redraw the image after the painting changes, serve the repo root on port 5174 and run:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=6000 --screenshot=og.png http://localhost:5174/issues/tools/og.html`
- The favicon is an S drawn as a route between two nodes (`favicon.svg`, with PNG copies). The
  earlier drawn avatar is kept in `favicons/avatar/`. Saloni should say which she prefers.
- Every later push to `main` redeploys on its own.
- A git stash holds an earlier full rewrite that was rejected (safe to drop once this ships).
- After launch: update her GitHub bio link and repo homepage, which point at the dead
  `salonibalkondekar.codes`.

## Artwork permission (added 2026-11-15)

`src/painting.svg` is the painting from leerob.com, which has no licence. The site adds its own
port, train and night layer on top, but most of the picture is still his. Before the site goes
public, get Lee Robinson's permission or replace the base painting (see 04).
