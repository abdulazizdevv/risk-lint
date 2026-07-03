export type IssueLevel = "high" | "medium" | "low"

export type Issue = {
  level: IssueLevel
  file: string
  line: number
  column: number
  message: string
}

export type Location = {
  file: string
  line: number
  column: number
}
