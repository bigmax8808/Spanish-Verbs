
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const getRandomItem = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

export const checkAnswer = (userAnswer: string, correctAnswer: string) => {
  const normUser = normalizeString(userAnswer.trim());
  const normCorrect = normalizeString(correctAnswer.trim());

  // If normalized versions match, they are the same word/conjugation but might differ in accents
  if (normUser === normCorrect) {
    if (userAnswer.trim() === correctAnswer.trim()) {
      return { isCorrect: true, isAccentError: false };
    }
    // Now treated as incorrect but specifically flagged as an accent error
    return { isCorrect: false, isAccentError: true };
  }
  
  // Total mismatch
  return { isCorrect: false, isAccentError: false };
};
