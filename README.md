# Ciatta

Ciatta contains an Expo mobile application for organizing personal health observations and a separate React web scaffold. The mobile source brings together onboarding, account management, health data integrations, insight views and visit preparation.

**Primary stack:** TypeScript, React Native, Expo, Supabase and PostgreSQL, with Deno for backend functions and selected tests.

## Repository guide

1. [Mobile application](ciatta-mobile-app/): the main application and its screens, components and shared logic.
2. [Backend functions](ciatta-mobile-app/supabase/functions/): understanding logic, provider search, discovery notifications and account deletion.
3. [Database migrations](ciatta-mobile-app/supabase/migrations/): versioned schema and behavior changes.
4. [Web scaffold](ciatta-web/): a React/Vite starter. Its current entry screen is the Vite demo, not a completed web version of the mobile product.

## Engineering areas

1. **Session and account handling:** Supabase authentication and persisted mobile sessions.
2. **Mobile data integrations:** source modules for Apple HealthKit, Android Health Connect and calendar context.
3. **Application structure:** separate screens, overlays, reusable components, design tokens and data access modules.
4. **Database evolution:** Supabase SQL migrations alongside server functions.
5. **Testable application logic:** Deno suites for onboarding, observations, provider search, visit preparation and other application behavior.

Platform integrations require their own permissions and configuration. Source modules and test files do not establish that every device workflow has been verified.

## Mobile setup

Use the dependencies recorded in [package.json](ciatta-mobile-app/package.json) and its lockfile. The app currently uses Expo 57 and React Native 0.86.

```bash
cd ciatta-mobile-app
npm ci
cp .env.example .env
```

Set the Supabase project URL and public anon key in `.env` using the provided example. Configure the Google client IDs if you intend to use Google sign in. Never put a Supabase service role key in the mobile app or commit private credentials.

Use a separate development Supabase project and review the migrations and functions before applying them. Do not apply development database changes to a production project.

```bash
npm run start
```

The repository also defines `npm run android`, `npm run ios` and `npm run web`. Native health integrations require an appropriately configured native development build, device permissions and platform tooling; a browser preview is not an equivalent test.

## Tests

Install Deno as well as the application's Node dependencies. From the mobile directory:

```bash
npm run test:all
```

Focused scripts such as `test:onboarding`, `test:healthkit`, `test:engine` and `test:provider-search` are listed in the package manifest. These commands document the existing test entry points, not a claim that the latest run passed.

## Web scaffold

```bash
cd ciatta-web
npm ci
npm run dev
```

The web package also provides `npm run build`, `npm run lint` and `npm run preview`.

## Status and responsible use

This is experimental software, not a clinically validated medical product. Do not interpret generated insights as a diagnosis or a substitute for professional care. Use synthetic development data until privacy, consent, access control and health platform requirements have been reviewed.

This guide describes the repository contents. It does not claim clinical outcomes, commercial adoption or ownership of every upstream dependency.
