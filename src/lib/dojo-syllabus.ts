// Kalvium Coding Dojo syllabus (v2, effective 03-11-26), belt by belt, with
// hand-picked LeetCode problems per topic. `tags` are LeetCode topic slugs
// used to spot weak areas from a student's solved counts. Plain data: edit
// freely. Problems are ordered easiest first.

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Problem = { slug: string; title: string; difficulty: Difficulty };
export type MoreLink = { name: string; url: string };
export type Topic = { name: string; summary: string; tags: string[]; problems: Problem[]; more?: MoreLink[] };
export type Belt = { level: number; name: string; band: string; focus: string; outcome: string; topics: Topic[] };

const p = (slug: string, title: string, difficulty: Difficulty): Problem => ({ slug, title, difficulty });
const cf = (tag: string): MoreLink => ({ name: `Codeforces · ${tag}`, url: `https://codeforces.com/problemset?tags=${encodeURIComponent(tag)}` });
const CSES = (section: string): MoreLink => ({ name: `CSES · ${section}`, url: "https://cses.fi/problemset/" });
const HR = (name: string, path: string): MoreLink => ({ name: `HackerRank · ${name}`, url: `https://www.hackerrank.com/domains/${path}` });

export const SYLLABUS: Belt[] = [
  {
    level: 1,
    name: "Yellow",
    band: "Beginner",
    focus: "Programming foundations",
    outcome: "Write complete programs using functions, conditionals and formatted input/output, trace a short program, and fix basic errors.",
    topics: [
      {
        name: "Operators & expressions",
        summary: "Arithmetic, relational, logical and assignment operators; precedence; type conversion.",
        tags: ["math"],
        problems: [
          p("add-two-integers", "Add Two Integers", "Easy"),
          p("convert-the-temperature", "Convert the Temperature", "Easy"),
          p("smallest-even-multiple", "Smallest Even Multiple", "Easy"),
        ],
        more: [HR("Language basics", "algorithms?filters%5Bsubdomains%5D%5B%5D=warmup")],
      },
      {
        name: "Conditionals",
        summary: "if / else, nested conditions, switch and the ternary operator.",
        tags: ["math", "simulation"],
        problems: [
          p("fizz-buzz", "Fizz Buzz", "Easy"),
          p("account-balance-after-rounded-purchase", "Account Balance After Rounded Purchase", "Easy"),
          p("count-of-matches-in-tournament", "Count of Matches in Tournament", "Easy"),
        ],
      },
      {
        name: "Functions & tracing",
        summary: "Parameters and return values, pass by value vs reference, scope, and tracing code line by line.",
        tags: ["simulation"],
        problems: [
          p("final-value-of-variable-after-performing-operations", "Final Value of Variable After Performing Operations", "Easy"),
          p("number-of-steps-to-reduce-a-number-to-zero", "Number of Steps to Reduce a Number to Zero", "Easy"),
          p("defanging-an-ip-address", "Defanging an IP Address", "Easy"),
        ],
      },
    ],
  },
  {
    level: 2,
    name: "Orange",
    band: "Beginner",
    focus: "Iteration, control flow & elementary computation",
    outcome: "Solve loop, pattern and number problems, write an elementary sort from scratch, and explain why some code is slower.",
    topics: [
      {
        name: "Loops & digit problems",
        summary: "for / while / do-while, break and continue, nested loops, loops that stop on a special value.",
        tags: ["math", "simulation"],
        problems: [
          p("subtract-the-product-and-sum-of-digits-of-an-integer", "Subtract the Product and Sum of Digits of an Integer", "Easy"),
          p("count-the-digits-that-divide-a-number", "Count the Digits That Divide a Number", "Easy"),
          p("add-digits", "Add Digits", "Easy"),
          p("palindrome-number", "Palindrome Number", "Easy"),
        ],
      },
      {
        name: "Patterns",
        summary: "Star, number and alphabet patterns: pyramids, diamonds, hollow shapes.",
        tags: ["array"],
        problems: [p("pascals-triangle", "Pascal's Triangle", "Easy"), p("pascals-triangle-ii", "Pascal's Triangle II", "Easy")],
        more: [HR("Pattern warm-ups", "algorithms?filters%5Bsubdomains%5D%5B%5D=warmup")],
      },
      {
        name: "Math & number theory",
        summary: "GCD / LCM, primes and the Sieve of Eratosthenes, modular arithmetic, fast exponentiation.",
        tags: ["math", "number-theory"],
        problems: [
          p("find-greatest-common-divisor-of-array", "Find Greatest Common Divisor of Array", "Easy"),
          p("happy-number", "Happy Number", "Easy"),
          p("ugly-number", "Ugly Number", "Easy"),
          p("count-primes", "Count Primes", "Medium"),
          p("powx-n", "Pow(x, n)", "Medium"),
        ],
        more: [cf("number theory"), cf("math")],
      },
    ],
  },
  {
    level: 3,
    name: "Green",
    band: "Beginner → Intermediate",
    focus: "Linear data handling",
    outcome: "Write array, string and matrix programs, recognise common patterns, and state whether a solution is O(1), O(n) or O(n²).",
    topics: [
      {
        name: "Arrays",
        summary: "Traversal, insert/delete by shifting, reverse, rotate, merging sorted arrays.",
        tags: ["array"],
        problems: [
          p("merge-sorted-array", "Merge Sorted Array", "Easy"),
          p("move-zeroes", "Move Zeroes", "Easy"),
          p("remove-duplicates-from-sorted-array", "Remove Duplicates from Sorted Array", "Easy"),
          p("rotate-array", "Rotate Array", "Medium"),
        ],
        more: [cf("implementation")],
      },
      {
        name: "Strings",
        summary: "Substrings, comparison, palindrome and anagram checks, reversal, basic compression.",
        tags: ["string"],
        problems: [
          p("valid-palindrome", "Valid Palindrome", "Easy"),
          p("valid-anagram", "Valid Anagram", "Easy"),
          p("longest-common-prefix", "Longest Common Prefix", "Easy"),
          p("reverse-words-in-a-string", "Reverse Words in a String", "Medium"),
          p("string-compression", "String Compression", "Medium"),
        ],
        more: [cf("strings")],
      },
      {
        name: "Matrices",
        summary: "Transpose, rotation, spiral / boundary / diagonal traversal, matrix search.",
        tags: ["matrix"],
        problems: [
          p("matrix-diagonal-sum", "Matrix Diagonal Sum", "Easy"),
          p("transpose-matrix", "Transpose Matrix", "Easy"),
          p("rotate-image", "Rotate Image", "Medium"),
          p("spiral-matrix", "Spiral Matrix", "Medium"),
        ],
      },
      {
        name: "Frequency counting",
        summary: "Most / least frequent element, permutation checks.",
        tags: ["counting", "hash-table"],
        problems: [
          p("first-unique-character-in-a-string", "First Unique Character in a String", "Easy"),
          p("majority-element", "Majority Element", "Easy"),
          p("find-all-numbers-disappeared-in-an-array", "Find All Numbers Disappeared in an Array", "Easy"),
          p("sort-characters-by-frequency", "Sort Characters By Frequency", "Medium"),
        ],
      },
    ],
  },
  {
    level: 4,
    name: "Purple",
    band: "Intermediate",
    focus: "Problem solving using arrays & searching",
    outcome: "Pick the right technique for a new array problem, turn brute force into a faster solution, and explain its time and memory.",
    topics: [
      {
        name: "Prefix & suffix sums",
        summary: "Prefix sums and XOR, product except self, pivot index, subarray sums.",
        tags: ["prefix-sum"],
        problems: [
          p("range-sum-query-immutable", "Range Sum Query - Immutable", "Easy"),
          p("find-pivot-index", "Find Pivot Index", "Easy"),
          p("product-of-array-except-self", "Product of Array Except Self", "Medium"),
          p("subarray-sum-equals-k", "Subarray Sum Equals K", "Medium"),
        ],
        more: [CSES("Range Queries")],
      },
      {
        name: "Hashing",
        summary: "Counting and lookup: Two Sum, subarray sum K, group anagrams.",
        tags: ["hash-table"],
        problems: [
          p("two-sum", "Two Sum", "Easy"),
          p("contains-duplicate", "Contains Duplicate", "Easy"),
          p("group-anagrams", "Group Anagrams", "Medium"),
          p("longest-consecutive-sequence", "Longest Consecutive Sequence", "Medium"),
        ],
      },
      {
        name: "Classic array algorithms",
        summary: "Kadane's, Dutch National Flag, Moore's Voting.",
        tags: ["array"],
        problems: [
          p("maximum-subarray", "Maximum Subarray", "Medium"),
          p("sort-colors", "Sort Colors", "Medium"),
          p("majority-element-ii", "Majority Element II", "Medium"),
        ],
      },
      {
        name: "Sliding window",
        summary: "Fixed and variable size windows.",
        tags: ["sliding-window"],
        problems: [
          p("maximum-average-subarray-i", "Maximum Average Subarray I", "Easy"),
          p("longest-substring-without-repeating-characters", "Longest Substring Without Repeating Characters", "Medium"),
          p("minimum-size-subarray-sum", "Minimum Size Subarray Sum", "Medium"),
          p("permutation-in-string", "Permutation in String", "Medium"),
        ],
      },
      {
        name: "Two pointers",
        summary: "Opposite ends and same direction; three-sum.",
        tags: ["two-pointers"],
        problems: [
          p("squares-of-a-sorted-array", "Squares of a Sorted Array", "Easy"),
          p("two-sum-ii-input-array-is-sorted", "Two Sum II - Input Array Is Sorted", "Medium"),
          p("container-with-most-water", "Container With Most Water", "Medium"),
          p("3sum", "3Sum", "Medium"),
        ],
        more: [cf("two pointers")],
      },
      {
        name: "Binary search",
        summary: "Lower / upper bound, rotated arrays, 2D matrix, peak element.",
        tags: ["binary-search"],
        problems: [
          p("binary-search", "Binary Search", "Easy"),
          p("search-insert-position", "Search Insert Position", "Easy"),
          p("find-first-and-last-position-of-element-in-sorted-array", "Find First and Last Position of Element in Sorted Array", "Medium"),
          p("search-in-rotated-sorted-array", "Search in Rotated Sorted Array", "Medium"),
          p("find-peak-element", "Find Peak Element", "Medium"),
        ],
        more: [cf("binary search")],
      },
      {
        name: "Sorting without comparisons",
        summary: "Elementary sorts, stability, counting sort and radix sort.",
        tags: ["sorting", "counting-sort", "radix-sort"],
        problems: [
          p("relative-sort-array", "Relative Sort Array", "Easy"),
          p("sort-an-array", "Sort an Array", "Medium"),
          p("maximum-gap", "Maximum Gap", "Medium"),
        ],
        more: [CSES("Sorting and Searching")],
      },
    ],
  },
  {
    level: 5,
    name: "Blue",
    band: "Intermediate",
    focus: "Linear data structures & their applications",
    outcome: "Build each linear data structure from scratch, solve problems like cycle detection and next greater element, and explain why a structure suits a problem.",
    topics: [
      {
        name: "Linked lists",
        summary: "Singly, doubly and circular lists; reverse, middle, merge sorted lists.",
        tags: ["linked-list"],
        problems: [
          p("reverse-linked-list", "Reverse Linked List", "Easy"),
          p("middle-of-the-linked-list", "Middle of the Linked List", "Easy"),
          p("merge-two-sorted-lists", "Merge Two Sorted Lists", "Easy"),
          p("remove-nth-node-from-end-of-list", "Remove Nth Node From End of List", "Medium"),
          p("design-linked-list", "Design Linked List", "Medium"),
        ],
      },
      {
        name: "Stacks",
        summary: "Valid parentheses, next greater / smaller element, stock span, min-stack.",
        tags: ["stack"],
        problems: [
          p("valid-parentheses", "Valid Parentheses", "Easy"),
          p("next-greater-element-i", "Next Greater Element I", "Easy"),
          p("min-stack", "Min Stack", "Medium"),
          p("online-stock-span", "Online Stock Span", "Medium"),
        ],
      },
      {
        name: "Queues & deques",
        summary: "Array / linked-list queues, circular queue, deque, sliding window maximum.",
        tags: ["queue"],
        problems: [
          p("implement-queue-using-stacks", "Implement Queue using Stacks", "Easy"),
          p("design-circular-queue", "Design Circular Queue", "Medium"),
          p("design-circular-deque", "Design Circular Deque", "Medium"),
          p("sliding-window-maximum", "Sliding Window Maximum", "Hard"),
        ],
      },
      {
        name: "Monotonic stack",
        summary: "A stack kept always increasing or decreasing.",
        tags: ["monotonic-stack"],
        problems: [
          p("daily-temperatures", "Daily Temperatures", "Medium"),
          p("next-greater-element-ii", "Next Greater Element II", "Medium"),
          p("largest-rectangle-in-histogram", "Largest Rectangle in Histogram", "Hard"),
        ],
      },
      {
        name: "Hare & tortoise",
        summary: "Slow and fast pointers: cycle detection, cycle start and length.",
        tags: ["two-pointers", "linked-list"],
        problems: [
          p("linked-list-cycle", "Linked List Cycle", "Easy"),
          p("linked-list-cycle-ii", "Linked List Cycle II", "Medium"),
          p("find-the-duplicate-number", "Find the Duplicate Number", "Medium"),
        ],
      },
    ],
  },
  {
    level: 6,
    name: "Brown",
    band: "Intermediate → Advanced",
    focus: "Recursion, divide & conquer, and backtracking",
    outcome: "Design and trace recursive solutions, write Merge Sort and Quick Sort, solve Word Search and subset / permutation problems, and state their complexity.",
    topics: [
      {
        name: "Recursion",
        summary: "Base and recursive cases, the call stack, recursion trees.",
        tags: ["recursion"],
        problems: [
          p("fibonacci-number", "Fibonacci Number", "Easy"),
          p("power-of-two", "Power of Two", "Easy"),
          p("reverse-string", "Reverse String", "Easy"),
          p("powx-n", "Pow(x, n)", "Medium"),
        ],
      },
      {
        name: "Divide & conquer",
        summary: "Merge Sort, Quick Sort, Quickselect.",
        tags: ["divide-and-conquer", "quickselect"],
        problems: [
          p("sort-an-array", "Sort an Array", "Medium"),
          p("sort-list", "Sort List", "Medium"),
          p("kth-largest-element-in-an-array", "Kth Largest Element in an Array", "Medium"),
        ],
        more: [cf("divide and conquer")],
      },
      {
        name: "Generating possibilities",
        summary: "Subsets, permutations, combinations, handling duplicates.",
        tags: ["backtracking"],
        problems: [
          p("subsets", "Subsets", "Medium"),
          p("permutations", "Permutations", "Medium"),
          p("combinations", "Combinations", "Medium"),
          p("subsets-ii", "Subsets II", "Medium"),
          p("combination-sum", "Combination Sum", "Medium"),
        ],
      },
      {
        name: "Searching with rules",
        summary: "Word Search, N-Queens, Sudoku, Rat in a Maze; choose, explore, un-choose; pruning.",
        tags: ["backtracking"],
        problems: [
          p("letter-combinations-of-a-phone-number", "Letter Combinations of a Phone Number", "Medium"),
          p("word-search", "Word Search", "Medium"),
          p("n-queens", "N-Queens", "Hard"),
          p("sudoku-solver", "Sudoku Solver", "Hard"),
        ],
        more: [CSES("Introductory Problems")],
      },
    ],
  },
  {
    level: 7,
    name: "Sr. Brown",
    band: "Advanced",
    focus: "Search & greedy strategies",
    outcome: "Choose between binary search on the answer and greedy, justify a greedy choice, and recognise when dynamic programming is needed.",
    topics: [
      {
        name: "Binary search on the answer",
        summary: "Feasibility checks; minimise the maximum, maximise the minimum.",
        tags: ["binary-search"],
        problems: [
          p("koko-eating-bananas", "Koko Eating Bananas", "Medium"),
          p("capacity-to-ship-packages-within-d-days", "Capacity To Ship Packages Within D Days", "Medium"),
          p("minimum-number-of-days-to-make-m-bouquets", "Minimum Number of Days to Make m Bouquets", "Medium"),
          p("magnetic-force-between-two-balls", "Magnetic Force Between Two Balls", "Medium"),
          p("split-array-largest-sum", "Split Array Largest Sum", "Hard"),
        ],
        more: [cf("binary search")],
      },
      {
        name: "Greedy",
        summary: "Greedy-choice property, activity selection, interval scheduling, jump game.",
        tags: ["greedy"],
        problems: [
          p("assign-cookies", "Assign Cookies", "Easy"),
          p("jump-game", "Jump Game", "Medium"),
          p("non-overlapping-intervals", "Non-overlapping Intervals", "Medium"),
          p("gas-station", "Gas Station", "Medium"),
          p("jump-game-ii", "Jump Game II", "Medium"),
        ],
        more: [cf("greedy")],
      },
      {
        name: "When greedy fails",
        summary: "0-1 knapsack, coin change, longest increasing subsequence.",
        tags: ["dynamic-programming"],
        problems: [
          p("coin-change", "Coin Change", "Medium"),
          p("partition-equal-subset-sum", "Partition Equal Subset Sum", "Medium"),
          p("longest-increasing-subsequence", "Longest Increasing Subsequence", "Medium"),
        ],
      },
    ],
  },
  {
    level: 8,
    name: "Red",
    band: "Advanced",
    focus: "Trees & heaps / priority queues",
    outcome: "Traverse and solve tree problems, implement BST operations including delete, and use a heap for top-K and streaming problems.",
    topics: [
      {
        name: "Tree traversals",
        summary: "Inorder, preorder, postorder (recursive and iterative), level order, Morris.",
        tags: ["binary-tree", "tree"],
        problems: [
          p("binary-tree-inorder-traversal", "Binary Tree Inorder Traversal", "Easy"),
          p("binary-tree-preorder-traversal", "Binary Tree Preorder Traversal", "Easy"),
          p("binary-tree-postorder-traversal", "Binary Tree Postorder Traversal", "Easy"),
          p("binary-tree-level-order-traversal", "Binary Tree Level Order Traversal", "Medium"),
        ],
      },
      {
        name: "Binary search trees",
        summary: "Search, insert, delete, validate, kth smallest.",
        tags: ["binary-search-tree"],
        problems: [
          p("search-in-a-binary-search-tree", "Search in a Binary Search Tree", "Easy"),
          p("insert-into-a-binary-search-tree", "Insert into a Binary Search Tree", "Medium"),
          p("validate-binary-search-tree", "Validate Binary Search Tree", "Medium"),
          p("kth-smallest-element-in-a-bst", "Kth Smallest Element in a BST", "Medium"),
          p("delete-node-in-a-bst", "Delete Node in a BST", "Medium"),
        ],
      },
      {
        name: "Common tree problems",
        summary: "Diameter, path sum, LCA, mirror, symmetry.",
        tags: ["binary-tree", "depth-first-search"],
        problems: [
          p("maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", "Easy"),
          p("invert-binary-tree", "Invert Binary Tree", "Easy"),
          p("symmetric-tree", "Symmetric Tree", "Easy"),
          p("diameter-of-binary-tree", "Diameter of Binary Tree", "Easy"),
          p("lowest-common-ancestor-of-a-binary-tree", "Lowest Common Ancestor of a Binary Tree", "Medium"),
        ],
        more: [CSES("Tree Algorithms")],
      },
      {
        name: "Heaps & priority queues",
        summary: "Heapify, heap sort, top-K, merge K sorted lists, median of a stream.",
        tags: ["heap-priority-queue"],
        problems: [
          p("last-stone-weight", "Last Stone Weight", "Easy"),
          p("kth-largest-element-in-a-stream", "Kth Largest Element in a Stream", "Easy"),
          p("top-k-frequent-elements", "Top K Frequent Elements", "Medium"),
          p("merge-k-sorted-lists", "Merge k Sorted Lists", "Hard"),
          p("find-median-from-data-stream", "Find Median from Data Stream", "Hard"),
        ],
      },
    ],
  },
  {
    level: 9,
    name: "Sr. Red",
    band: "Advanced",
    focus: "Graph algorithms",
    outcome: "Model problems as graphs, choose the right representation and shortest-path algorithm, and build a minimum spanning tree.",
    topics: [
      {
        name: "BFS & DFS",
        summary: "Traversals, connected components, multi-source BFS.",
        tags: ["breadth-first-search", "depth-first-search", "graph"],
        problems: [
          p("flood-fill", "Flood Fill", "Easy"),
          p("number-of-islands", "Number of Islands", "Medium"),
          p("number-of-provinces", "Number of Provinces", "Medium"),
          p("rotting-oranges", "Rotting Oranges", "Medium"),
          p("01-matrix", "01 Matrix", "Medium"),
        ],
        more: [CSES("Graph Algorithms"), cf("dfs and similar")],
      },
      {
        name: "Cycles, bipartite & topological sort",
        summary: "Cycle detection in directed and undirected graphs, bipartite check, Kahn's algorithm.",
        tags: ["topological-sort", "graph"],
        problems: [
          p("is-graph-bipartite", "Is Graph Bipartite?", "Medium"),
          p("course-schedule", "Course Schedule", "Medium"),
          p("course-schedule-ii", "Course Schedule II", "Medium"),
          p("find-eventual-safe-states", "Find Eventual Safe States", "Medium"),
        ],
      },
      {
        name: "Shortest paths",
        summary: "Dijkstra, Bellman-Ford, Floyd-Warshall, and choosing between them.",
        tags: ["shortest-path"],
        problems: [
          p("network-delay-time", "Network Delay Time", "Medium"),
          p("path-with-minimum-effort", "Path With Minimum Effort", "Medium"),
          p("cheapest-flights-within-k-stops", "Cheapest Flights Within K Stops", "Medium"),
          p("find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance", "Find the City With the Smallest Number of Neighbors at a Threshold Distance", "Medium"),
        ],
        more: [cf("shortest paths")],
      },
      {
        name: "MST & disjoint sets",
        summary: "Prim's and Kruskal's; union by rank and path compression.",
        tags: ["minimum-spanning-tree", "union-find"],
        problems: [
          p("redundant-connection", "Redundant Connection", "Medium"),
          p("number-of-operations-to-make-network-connected", "Number of Operations to Make Network Connected", "Medium"),
          p("min-cost-to-connect-all-points", "Min Cost to Connect All Points", "Medium"),
          p("accounts-merge", "Accounts Merge", "Medium"),
        ],
        more: [cf("dsu")],
      },
    ],
  },
  {
    level: 10,
    name: "Black",
    band: "Advanced mastery",
    focus: "Dynamic programming, tries, bit manipulation & string matching",
    outcome: "Define a DP state and transition, write top-down and bottom-up solutions, explain why greedy fails where DP works, and use tries, bit tricks and KMP / Rabin-Karp.",
    topics: [
      {
        name: "Dynamic programming",
        summary: "State, transition, memoization, tabulation; 1D, grid, string, knapsack, LIS, tree DP.",
        tags: ["dynamic-programming", "memoization"],
        problems: [
          p("climbing-stairs", "Climbing Stairs", "Easy"),
          p("house-robber", "House Robber", "Medium"),
          p("unique-paths", "Unique Paths", "Medium"),
          p("longest-common-subsequence", "Longest Common Subsequence", "Medium"),
          p("coin-change-ii", "Coin Change II", "Medium"),
          p("edit-distance", "Edit Distance", "Medium"),
          p("house-robber-iii", "House Robber III", "Medium"),
        ],
        more: [CSES("Dynamic Programming"), cf("dp")],
      },
      {
        name: "Greedy vs DP",
        summary: "Activity selection vs weighted job scheduling; fractional vs 0-1 knapsack.",
        tags: ["dynamic-programming", "greedy"],
        problems: [p("maximum-profit-in-job-scheduling", "Maximum Profit in Job Scheduling", "Hard")],
      },
      {
        name: "Tries",
        summary: "Insert, search and prefix search.",
        tags: ["trie"],
        problems: [
          p("implement-trie-prefix-tree", "Implement Trie (Prefix Tree)", "Medium"),
          p("design-add-and-search-words-data-structure", "Design Add and Search Words Data Structure", "Medium"),
          p("word-search-ii", "Word Search II", "Hard"),
        ],
      },
      {
        name: "Bit manipulation",
        summary: "Bitwise operators, set bits, single number, missing number.",
        tags: ["bit-manipulation"],
        problems: [
          p("single-number", "Single Number", "Easy"),
          p("number-of-1-bits", "Number of 1 Bits", "Easy"),
          p("missing-number", "Missing Number", "Easy"),
          p("counting-bits", "Counting Bits", "Easy"),
          p("reverse-bits", "Reverse Bits", "Easy"),
        ],
        more: [cf("bitmasks")],
      },
      {
        name: "String matching",
        summary: "KMP and Rabin-Karp: fast ways to find a pattern in text.",
        tags: ["string-matching", "rolling-hash"],
        problems: [
          p("find-the-index-of-the-first-occurrence-in-a-string", "Find the Index of the First Occurrence in a String", "Easy"),
          p("repeated-string-match", "Repeated String Match", "Medium"),
          p("shortest-palindrome", "Shortest Palindrome", "Hard"),
        ],
        more: [cf("string suffix structures")],
      },
    ],
  },
];

export const beltByLevel = (level: number) => SYLLABUS.find((belt) => belt.level === level) ?? null;

export type TopicPlan = Omit<Topic, "problems"> & {
  /** Problems the student has solved in this topic's LeetCode tags (null when unknown). */
  tagSolved: number | null;
  problems: Array<Problem & { solved: boolean }>;
  weak: boolean;
};

/**
 * Orders a belt's topics weakest first (fewest LeetCode problems solved in the
 * topic's tags) and marks problems already solved. Without LeetCode data the
 * syllabus order is kept.
 */
export function planTopics(belt: Belt, tagCounts: Record<string, number> | null, solvedSlugs: Set<string>): TopicPlan[] {
  const plans = belt.topics.map((topic, index) => {
    const tagSolved = tagCounts ? topic.tags.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0) : null;
    const problems = topic.problems.map((problem) => ({ ...problem, solved: solvedSlugs.has(problem.slug) }));
    return { ...topic, tagSolved, problems, weak: false, index };
  });
  if (tagCounts) {
    const counts = plans.map((plan) => plan.tagSolved ?? 0).sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)] ?? 0;
    for (const plan of plans) plan.weak = (plan.tagSolved ?? 0) < Math.max(3, median);
    plans.sort((a, b) => (a.tagSolved ?? 0) - (b.tagSolved ?? 0) || a.index - b.index);
  }
  return plans.map((plan) => {
    const { index, ...rest } = plan;
    void index;
    return rest;
  });
}

/** Today's pick: the first unsolved problem in the weakest topic, easiest first. */
export function pickProblem(plans: TopicPlan[]) {
  for (const plan of plans) {
    const next = plan.problems.find((problem) => !problem.solved);
    if (next) return { topic: plan.name, problem: next };
  }
  return null;
}
