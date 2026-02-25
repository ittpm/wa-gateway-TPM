export function spin(text: string): string {
  // Find spintax pattern {option1|option2|option3}
  const spintaxRegex = /\{([^}]+)\}/g;
  
  return text.replace(spintaxRegex, (match, content) => {
    const options = content.split('|').map((o: string) => o.trim());
    return options[Math.floor(Math.random() * options.length)];
  });
}

export function isSpintax(text: string): boolean {
  return /\{[^}]+\|[^}]+\}/.test(text);
}
