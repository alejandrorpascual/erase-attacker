export async function* identityGenerator<T>(stream: AsyncIterable<T>) {
  for await (const chunk of stream) {
    yield chunk;
  }
}

export function getLoggerGenerator<T>(
  logger: (chunk: T) => void = console.log,
) {
  return async function* loggerGenerator(stream: AsyncIterable<T>) {
    for await (const chunk of stream) {
      logger(chunk);
      yield chunk;
    }
  };
}
