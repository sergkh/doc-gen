export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class CourseNotFoundError extends NotFoundError {
  constructor(id: number) {
    super(`Course with ID ${id} not found`);
    this.name = "CourseNotFoundError";
  }
}

export class ConcurrentModificationError extends Error {
  constructor(id: number, version: number) {
    super(`Concurrent modification detected for entity with ID ${id} and version ${version}`);
    this.name = "ConcurrentModificationError";
  }

}