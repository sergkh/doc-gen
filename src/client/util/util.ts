export function dropEmpty(obj: any, options: {blacklist: string[]} = {blacklist: []}): any {
  Object.keys(obj).forEach(key => {
    if(options.blacklist.includes(key)) return;
    if (obj[key] === null || obj[key] === "" || (Array.isArray(obj[key]) && obj[key].length === 0)) {
      delete obj[key];
    }
  });
  return obj;
}