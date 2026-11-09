HopeBridge CA2 - Separate Files

Open this folder in VS Code and run index.html with Live Server.

HTML files:
- index.html
- login.html
- register.html
- admin-dashboard.html
- donor-dashboard.html
- orphanage-dashboard.html

CSS files:
- style.css (homepage)
- auth.css (login and registration)
- admin.css
- donor.css
- orphanage.css

JavaScript files:
- script.js (homepage impact statistics)
- auth.js (login and registration)
- admin.js
- donor.js
- orphanage.js
- supabase.js (Supabase connection)

Keep all these files in the same folder. Do not rename the files unless you also update their references in HTML.
The Supabase publishable key is used in supabase.js. Never put a Supabase service-role/secret key in frontend code.
