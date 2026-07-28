const stamp = (): string => new Date().toISOString().slice(11, 23)

export const log = {
  info: (msg: string): void => console.log(`${stamp()} \u001b[36minfo\u001b[0m  ${msg}`),
  warn: (msg: string): void => console.warn(`${stamp()} \u001b[33mwarn\u001b[0m  ${msg}`),
  error: (msg: string, err?: unknown): void => {
    console.error(`${stamp()} \u001b[31merror\u001b[0m ${msg}`)
    if (err !== undefined) console.error(err)
  }
}
