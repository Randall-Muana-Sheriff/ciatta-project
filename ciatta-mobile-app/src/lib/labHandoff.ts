// Which test the lab detail screen opens on. Navigation carries a screen
// name only, so the row that was tapped leaves the test's name here first.
let chosen = '';

export const chooseLab = (name: string) => {
  chosen = name;
};

export const chosenLab = () => chosen;
