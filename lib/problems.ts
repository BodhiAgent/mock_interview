export type Difficulty = "easy" | "medium" | "hard";

export type Example = {
  input: string;
  output: string;
  note?: string;
};

export type Problem = {
  id: string;
  num: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  body: string;
  examples: Example[];
  constraints: string[];
  followUp?: string;
  hint: string;
  /** Initial editor stub. */
  stub: string;
  /** Hidden test runner, executed against /work/solution.py */
  testRunner: string;
  /** Interviewer's accept rate (display only) */
  accRate: number;
  avgMinutes: number;
  solved: string;
};

const PROBLEMS: Problem[] = [
  {
    id: "p001",
    num: "#001",
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    tags: ["array", "hash-map"],
    body:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`. You may assume that each input has **exactly one solution**, and you may not use the same element twice. The answer can be returned in any order.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", note: "nums[0] + nums[1] == 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
      { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    constraints: [
      "2 ≤ nums.length ≤ 10⁴",
      "-10⁹ ≤ nums[i] ≤ 10⁹",
      "-10⁹ ≤ target ≤ 10⁹",
      "Only one valid answer exists",
    ],
    followUp: "Can you come up with an algorithm that is less than O(n²) time complexity?",
    hint:
      "Walk the array once. For each value, check whether `target − value` is already in a hash map keyed by the values you've seen so far.",
    stub: `from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # TODO: return the indices of the two numbers that sum to target
        return []
`,
    testRunner: `import json, sys
from solution import Solution

cases = [
    ([2, 7, 11, 15], 9, [0, 1]),
    ([3, 2, 4], 6, [1, 2]),
    ([3, 3], 6, [0, 1]),
]

passed = 0
results = []
for nums, target, expected in cases:
    got = Solution().twoSum(list(nums), target)
    ok = sorted(got) == sorted(expected) if got else False
    results.append({"input": {"nums": nums, "target": target}, "expected": expected, "got": got, "ok": ok})
    if ok:
        passed += 1

print(json.dumps({"passed": passed, "total": len(cases), "results": results}, indent=2))
sys.exit(0 if passed == len(cases) else 1)
`,
    accRate: 49.7,
    avgMinutes: 8,
    solved: "8.4M",
  },
  {
    id: "p003",
    num: "#003",
    slug: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "medium",
    tags: ["string", "sliding-window", "hash-map"],
    body:
      "Given a string `s`, return the length of the **longest substring** without duplicate characters. The substring must be **contiguous** in the original string.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", note: 'The answer is "abc"; once we see the second a, the window slides forward.' },
      { input: 's = "bbbbb"', output: "1", note: "A run of identical characters yields a window of length one." },
      { input: 's = "pwwkew"', output: "3", note: '"wke" is a substring; "pwke" is a subsequence and does not count.' },
    ],
    constraints: [
      "0 ≤ s.length ≤ 5 × 10⁴",
      "s consists of English letters, digits, symbols and spaces",
      "Expected: O(n) time, O(Σ) space",
    ],
    followUp:
      "If `s` contained Unicode codepoints rather than just ASCII, would your solution still be linear? What would change about the auxiliary structure?",
    hint:
      "Two pointers in lockstep — the right hand expands; the left hand catches up only when a duplicate enters the window. The width at every step is your candidate for *best*.",
    stub: `from collections import defaultdict

class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # TODO: return the length of the longest substring without repeating characters
        return 0
`,
    testRunner: `import json, sys
from solution import Solution

cases = [
    ("abcabcbb", 3),
    ("bbbbb", 1),
    ("pwwkew", 3),
    ("", 0),
    ("au", 2),
    ("dvdf", 3),
]

passed = 0
results = []
for s, expected in cases:
    got = Solution().lengthOfLongestSubstring(s)
    ok = got == expected
    results.append({"input": s, "expected": expected, "got": got, "ok": ok})
    if ok:
        passed += 1

print(json.dumps({"passed": passed, "total": len(cases), "results": results}, indent=2))
sys.exit(0 if passed == len(cases) else 1)
`,
    accRate: 33.7,
    avgMinutes: 14,
    solved: "1.2M",
  },
  {
    id: "p020",
    num: "#020",
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "easy",
    tags: ["string", "stack"],
    body:
      "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[`, `]`, determine if the input string is valid. An input string is valid if open brackets are closed by the same type of bracket and in the correct order. Every close bracket must have a matching open bracket of the same type.",
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
      { input: 's = "([)]"', output: "false", note: "The order matters; brackets must close in LIFO order." },
    ],
    constraints: [
      "1 ≤ s.length ≤ 10⁴",
      "s consists of parentheses only: `()[]{}`",
    ],
    hint:
      "A stack mirrors the nesting. Push every opener; on a closer, the top of the stack must be its matching opener — otherwise reject.",
    stub: `class Solution:
    def isValid(self, s: str) -> bool:
        # TODO: return True iff brackets are balanced and properly ordered
        return False
`,
    testRunner: `import json, sys
from solution import Solution

cases = [
    ("()", True),
    ("()[]{}", True),
    ("(]", False),
    ("([)]", False),
    ("{[]}", True),
    ("", True),
    ("(", False),
]

passed = 0
results = []
for s, expected in cases:
    got = Solution().isValid(s)
    ok = got == expected
    results.append({"input": s, "expected": expected, "got": got, "ok": ok})
    if ok:
        passed += 1

print(json.dumps({"passed": passed, "total": len(cases), "results": results}, indent=2))
sys.exit(0 if passed == len(cases) else 1)
`,
    accRate: 41.2,
    avgMinutes: 9,
    solved: "5.6M",
  },
  {
    id: "p053",
    num: "#053",
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "medium",
    tags: ["array", "dp", "divide-and-conquer"],
    body:
      "Given an integer array `nums`, find the contiguous subarray with the largest sum and return its sum. A **subarray** is a contiguous, non-empty slice of the array.",
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", note: "The subarray [4,-1,2,1] has sum 6." },
      { input: "nums = [1]", output: "1" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    constraints: [
      "1 ≤ nums.length ≤ 10⁵",
      "-10⁴ ≤ nums[i] ≤ 10⁴",
      "Expected: O(n) time",
    ],
    followUp:
      "Solve it both with the standard O(n) Kadane's algorithm and with the divide-and-conquer approach in O(n log n). Talk through the tradeoffs.",
    hint:
      "Kadane's: at each index keep the best subarray ending here. The recurrence is best_ending = max(num, best_ending + num); the answer is the running maximum of that.",
    stub: `from typing import List

class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        # TODO: return the maximum subarray sum
        return 0
`,
    testRunner: `import json, sys
from solution import Solution

cases = [
    ([-2, 1, -3, 4, -1, 2, 1, -5, 4], 6),
    ([1], 1),
    ([5, 4, -1, 7, 8], 23),
    ([-1], -1),
    ([-2, -1], -1),
]

passed = 0
results = []
for nums, expected in cases:
    got = Solution().maxSubArray(list(nums))
    ok = got == expected
    results.append({"input": nums, "expected": expected, "got": got, "ok": ok})
    if ok:
        passed += 1

print(json.dumps({"passed": passed, "total": len(cases), "results": results}, indent=2))
sys.exit(0 if passed == len(cases) else 1)
`,
    accRate: 50.8,
    avgMinutes: 12,
    solved: "3.1M",
  },
  {
    id: "p042",
    num: "#042",
    slug: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "hard",
    tags: ["array", "two-pointers", "stack", "dp"],
    body:
      "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
    examples: [
      { input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", output: "6", note: "The elevation map can trap 6 units of water." },
      { input: "height = [4,2,0,3,2,5]", output: "9" },
    ],
    constraints: [
      "n == height.length",
      "1 ≤ n ≤ 2 × 10⁴",
      "0 ≤ height[i] ≤ 10⁵",
    ],
    followUp: "Solve it in O(1) extra space using a two-pointer technique.",
    hint:
      "At any column, the water it holds is min(maxLeft, maxRight) − height[i]. Compute these prefix maxima, or do it with two pointers in one pass.",
    stub: `from typing import List

class Solution:
    def trap(self, height: List[int]) -> int:
        # TODO: return total units of water trapped
        return 0
`,
    testRunner: `import json, sys
from solution import Solution

cases = [
    ([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], 6),
    ([4, 2, 0, 3, 2, 5], 9),
    ([0], 0),
    ([3, 0, 3], 3),
    ([5, 5, 5], 0),
]

passed = 0
results = []
for height, expected in cases:
    got = Solution().trap(list(height))
    ok = got == expected
    results.append({"input": height, "expected": expected, "got": got, "ok": ok})
    if ok:
        passed += 1

print(json.dumps({"passed": passed, "total": len(cases), "results": results}, indent=2))
sys.exit(0 if passed == len(cases) else 1)
`,
    accRate: 62.4,
    avgMinutes: 22,
    solved: "1.0M",
  },
];

export function listProblems(): Problem[] {
  return PROBLEMS;
}

export function getProblem(slug: string): Problem | undefined {
  return PROBLEMS.find((p) => p.slug === slug || p.id === slug);
}
