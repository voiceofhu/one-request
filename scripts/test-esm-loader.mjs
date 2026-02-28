export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative =
      specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith("/");
    const hasKnownExtension =
      specifier.endsWith(".js") ||
      specifier.endsWith(".mjs") ||
      specifier.endsWith(".cjs") ||
      specifier.endsWith(".json") ||
      specifier.endsWith(".node");

    if (
      isRelative &&
      !hasKnownExtension &&
      error &&
      error.code === "ERR_MODULE_NOT_FOUND"
    ) {
      return nextResolve(`${specifier}.js`, context);
    }

    throw error;
  }
}
