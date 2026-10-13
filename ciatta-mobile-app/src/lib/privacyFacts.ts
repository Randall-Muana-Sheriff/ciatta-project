// Who can see what, in her words, from how the app actually works. Each
// line is true of the code: the record is locked to her account by row level
// security; a meal photo goes to OpenAI to be read and is not kept by
// Ciatta; the weather request carries a rough area only; attachments stay
// on the phone; a clinician summary is made on the phone. A service she is
// not using is not listed, so the page describes her, not every user.

export type PrivacyFact = { title: string; body: string };

export function privacyFacts(input: { sources: string[]; providers: string[]; weatherOn: boolean; findingsOn: boolean }): PrivacyFact[] {
  const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const facts: PrivacyFact[] = [
    {
      title: 'Your record',
      body: 'Only you can see it, when you are signed in. Every part of it is locked to your account on Ciatta\'s servers, so no other account can read it. It is not sold, and it is not shared with anyone.',
    },
  ];
  if (input.sources.length) {
    facts.push({
      title: 'Your devices',
      body: `${list(input.sources)} sends Ciatta the readings you allowed. Ciatta only reads them; it never writes to them.`,
    });
  }
  if (input.providers.length) {
    facts.push({
      title: 'Your providers',
      body: `${list(input.providers)} sends the records you connected. You can disconnect a provider at any time.`,
    });
  }
  facts.push(
    {
      title: 'Meal photos',
      body: 'When you scan a meal, the photo is sent to OpenAI to name the foods and estimate them. Ciatta does not keep the photo on its servers; it stays on your phone with the meal.',
    },
    {
      title: 'Files you attach',
      body: 'Photos, videos and PDFs you add to a log or a record stay on this phone. They are not uploaded.',
    },
    {
      title: 'Summaries you share',
      body: 'A summary for a clinician is made on your phone, and goes only where you send it. Ciatta keeps no copy and no link to it.',
    },
  );
  if (input.weatherOn) {
    facts.push({
      title: 'Weather around you',
      body: 'Only a rough area, about 10 km, is sent to fetch the weather and air quality. Your location is never stored.',
    });
  }
  if (input.findingsOn) {
    facts.push({
      title: 'Notifications',
      body: 'Ciatta keeps your phone\'s notification address to tell you about new findings. A notification says that something was found, not what.',
    });
  }
  return facts;
}
