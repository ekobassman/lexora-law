import { checkScope } from "./scopeGate.ts";

export function runSelfTest() {
  const cases: [string, boolean][] = [
    ["Finanzamt Bescheid Frist Einspruch", true],
    ["Patate al forno ricetta", false],
    ["Kartoffelsalat rezept", false],
    ["Ho una lettera e non capisco", true],
    ["Come fare ricorso contro una multa", true],
    ["Netflix film consiglio", false],
    ["Jobcenter Antrag ausfüllen", true],
    ["Pizza margherita ingredients", false],
    ["Widerspruch gegen Bescheid", true],
  ];
  
  return cases.map(([m, expected]) => ({
    message: m,
    expected,
    got: checkScope(String(m)).inScope,
    pass: checkScope(String(m)).inScope === expected,
  }));
}
