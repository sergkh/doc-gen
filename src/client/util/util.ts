export function dropEmpty(obj: any) {
  Object.keys(obj).forEach(key => {
    if (obj[key] === "" || (Array.isArray(obj[key]) && obj[key].length === 0)) {
      delete obj[key];
    }
  });
  return obj;
}