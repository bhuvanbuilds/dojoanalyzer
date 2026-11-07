// Content for the student quest page: tips, daily quests and free places to
// learn, per Dojo language. Plain data so it is easy to edit.

import type { TargetLanguage } from "@/lib/belt-targets";

export type Tip = { title: string; body: string; code?: string };
export type Resource = { name: string; url: string; what: string; kind: "Docs" | "Practice" | "Course" | "Tool" };

export const LANGUAGE_TIPS: Record<TargetLanguage, Tip[]> = {
  python: [
    {
      title: "Let the loop give you the index",
      body: "Use enumerate instead of range(len(...)). It reads better and avoids off-by-one slips.",
      code: "for i, name in enumerate(names):\n    print(i, name)",
    },
    {
      title: "Count things with a dict, fast",
      body: "collections.Counter turns a counting loop into one line, and most_common() sorts it for you.",
      code: "from collections import Counter\nCounter('banana').most_common(1)  # [('a', 3)]",
    },
    {
      title: "Read input in one go",
      body: "For many numbers on one line, map + split is quicker and cleaner than looping over input().",
      code: "a, b = map(int, input().split())",
    },
    {
      title: "Slices are your friend",
      body: "s[::-1] reverses, s[1:-1] trims the ends, and slicing never raises an IndexError.",
    },
    {
      title: "Watch mutable defaults",
      body: "def f(items=[]) shares one list between calls. Use items=None and create the list inside.",
    },
  ],
  java: [
    {
      title: "StringBuilder for string loops",
      body: "Adding strings with + in a loop creates a new object every time. StringBuilder is far faster.",
      code: 'StringBuilder sb = new StringBuilder();\nfor (int x : nums) sb.append(x).append(" ");',
    },
    {
      title: "Compare strings with equals",
      body: "== checks if two references are the same object, not the same text. Use a.equals(b).",
    },
    {
      title: "Know your collections",
      body: "ArrayList for ordered lists, HashMap for lookups by key, HashSet to drop duplicates. Picking the right one is half the problem.",
    },
    {
      title: "Mind integer overflow",
      body: "int tops out near 2.1 billion. Sums and products of large numbers belong in long.",
      code: "long total = 0L;\ntotal += (long) a * b;",
    },
    {
      title: "Read the stack trace bottom-up",
      body: "The first line that points at your own file is usually where the bug is. Start there.",
    },
  ],
  cpp: [
    {
      title: "Speed up input and output",
      body: "Turn off sync with C streams for big inputs, and prefer '\\n' over endl, which flushes every time.",
      code: "ios::sync_with_stdio(false);\ncin.tie(nullptr);",
    },
    {
      title: "Reach for the STL first",
      body: "vector, map, set, sort and lower_bound solve most problems without writing your own structures.",
      code: "sort(v.begin(), v.end());",
    },
    {
      title: "Pass big things by reference",
      body: "Passing a vector by value copies all of it. Use const vector<int>& when you only read it.",
    },
    {
      title: "Use long long for big numbers",
      body: "int overflows silently. If values can pass two billion, use long long from the start.",
    },
    {
      title: "Initialise everything",
      body: "Local variables in C++ start with garbage values. Give every variable a value when you declare it.",
    },
  ],
  nodejs: [
    {
      title: "Always use === ",
      body: "== converts types before comparing (0 == '' is true). === compares value and type.",
    },
    {
      title: "async/await over callback chains",
      body: "Write asynchronous code that reads top to bottom, and wrap it in try/catch to handle errors.",
      code: "const data = await fs.promises.readFile(path, 'utf8');",
    },
    {
      title: "Array methods do the heavy lifting",
      body: "map, filter, reduce, some and find replace most manual loops and make intent obvious.",
      code: "const evens = nums.filter((n) => n % 2 === 0);",
    },
    {
      title: "const by default",
      body: "Use const unless you must reassign; then let. Avoid var, whose scoping causes surprises.",
    },
    {
      title: "Numbers are floating point",
      body: "0.1 + 0.2 isn't exactly 0.3. For very large integers, use BigInt (123n).",
    },
  ],
};

export const LANGUAGE_RESOURCES: Record<TargetLanguage, Resource[]> = {
  python: [
    { name: "The Python Tutorial", url: "https://docs.python.org/3/tutorial/", what: "The official, free walk-through of the language.", kind: "Docs" },
    { name: "Exercism · Python", url: "https://exercism.org/tracks/python", what: "Free exercises with automatic tests and mentor feedback.", kind: "Practice" },
    { name: "Python Tutor", url: "https://pythontutor.com/", what: "See your code run line by line, with every variable drawn out.", kind: "Tool" },
  ],
  java: [
    { name: "Learn Java (dev.java)", url: "https://dev.java/learn/", what: "Official Java tutorials from the language's own team.", kind: "Docs" },
    { name: "Exercism · Java", url: "https://exercism.org/tracks/java", what: "Free, test-driven practice from basics to harder problems.", kind: "Practice" },
    { name: "CodingBat · Java", url: "https://codingbat.com/java", what: "Short warm-up problems with instant checking.", kind: "Practice" },
  ],
  cpp: [
    { name: "LearnCpp.com", url: "https://www.learncpp.com/", what: "A free, thorough C++ course, chapter by chapter.", kind: "Course" },
    { name: "cppreference", url: "https://en.cppreference.com/", what: "The reference for the standard library and STL.", kind: "Docs" },
    { name: "Exercism · C++", url: "https://exercism.org/tracks/cpp", what: "Free exercises with tests to check your solutions.", kind: "Practice" },
  ],
  nodejs: [
    { name: "Node.js · Learn", url: "https://nodejs.org/en/learn", what: "Official guides to Node.js basics, async code and modules.", kind: "Docs" },
    { name: "javascript.info", url: "https://javascript.info/", what: "The modern JavaScript tutorial, from basics to advanced.", kind: "Course" },
    { name: "Exercism · JavaScript", url: "https://exercism.org/tracks/javascript", what: "Free practice problems with tests and feedback.", kind: "Practice" },
  ],
};
