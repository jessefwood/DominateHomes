/**
 * Reading a pasted list of agents.
 *
 * One line per agent, "Name, email", because that is how a roster comes out
 * of a spreadsheet or a group text. Commas, tabs, semicolons and angle
 * brackets around the address ("Amber Cuono <amber@example.com>") all work.
 */
export function parseRoster(text: string): { name: string; email: string; line: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const email = line.match(/[^\s,;<>]+@[^\s,;<>]+/)?.[0] ?? ''
      const name = line
        .replace(email, '')
        .replace(/[<>]/g, '')
        .replace(/[,;\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return { name, email, line }
    })
}
