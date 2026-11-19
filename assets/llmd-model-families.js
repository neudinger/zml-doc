const parentFamilies = ["DeepSeek", "Gemma", "LFM", "Llama", "Mistral", "Qwen", "StartLux"];

export function modelFamily(series) {
  if (series.startsWith("Ministral")) return "Mistral";
  return parentFamilies.find(parent => series.startsWith(parent)) ?? series;
}

export const compareNames = new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare;

export function modelName(checkpoint) {
  return checkpoint.split("/").at(-1);
}

export function compareCheckpoints(left, right) {
  return compareNames(modelName(left), modelName(right)) || compareNames(left, right);
}
