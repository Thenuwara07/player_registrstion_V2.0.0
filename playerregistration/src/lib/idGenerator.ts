export function generate1partSLBFId(userId: number): string {
  if (userId < 1000) {
    return `SLBF-${userId}`;
  }

  // Determine block (1000 -> A, 2000 -> B, etc.)
  const block = Math.floor(userId / 1000);
  const remainder = userId % 1000;

  // Convert block number to letter(s)
  const letter = numberToLetters(block);

  if (remainder === 0) {
    return `SLBF-${letter}`;
  } else {
    return `SLBF-${letter}${remainder}`;
  }
}

/**
 * Convert a positive number to Excel-like column letters:
 * 1 -> A, 2 -> B, ..., 26 -> Z, 27 -> AA, etc.
 */
function numberToLetters(num: number): string {
  let result = "";
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

export function idrestgenerator(
  slbfid: string,
  newasscode: string,
  newclubcode?: string,
  oldasscode?: string,
  oldclubcode?: string
): string {
  let result = slbfid;

  // Example 1: If there is no "old" association and club code
  if (!oldasscode && !oldclubcode) {
    if (newclubcode){
      result += `-${newasscode}/${newclubcode}`;
    }
    else{
      result += `-${newasscode}`;
    }
  } else {

    if (oldclubcode){
      const code = `-${oldasscode}/${oldclubcode}`;
      slbfid = slbfid.replace(code, ""); 
      result = slbfid;
      if (newclubcode){
        result += `-${newasscode}/${newclubcode}`;
      }else{
        result += `-${newasscode}`;
      }
    }
    else{
      const code = `-${oldasscode}`;
      slbfid = slbfid.replace(code, ""); 
      result = slbfid;
      if (newclubcode){
        result += `-${newasscode}/${newclubcode}`;
      }else{
        result += `-${newasscode}`;
      } 
    }
  }

  return result;
}
