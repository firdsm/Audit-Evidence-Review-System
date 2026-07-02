export class DriveNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DriveNotFoundError'
  }
}
