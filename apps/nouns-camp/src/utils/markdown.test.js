import { expect, test } from "vitest";
import { createRepostExtractor } from "@/utils/votes-and-feedbacks";

const sourceReasons = [
  "foo",
  "bar",
  `baz

+1

> foo`,
  "foo\u2028bar",
];

test("repost extraction", () => {
  const extract = createRepostExtractor(
    sourceReasons.map((reason) => ({ reason })),
  );

  const tests = [
    { reason: "+1\n\n> foo", expectedMatchIndecies: [0] },
    {
      reason: `comment

+1

> bar

comment

+1

>baz

comment`,
      expectedMatchIndecies: [1, 2],
    },
    {
      reason: `comment

+1

> baz
>
> +1
>
> > foo`,
      expectedMatchIndecies: [2],
    },
    { reason: "+1\n\n> foo\u2028bar", expectedMatchIndecies: [0] },
    { reason: "+1\n\n> foo\u2028> bar", expectedMatchIndecies: [3] },
  ];

  for (const { reason, expectedMatchIndecies } of tests) {
    const [matchingPosts] = extract(reason);
    const matchingReasons = matchingPosts.map((p) => p.reason);
    const expectedMatchingReasons = expectedMatchIndecies.map(
      (index) => sourceReasons[index],
    );
    for (const expectedMatchingReason of expectedMatchingReasons) {
      expect(matchingReasons).toContain(expectedMatchingReason);
    }
    for (const matchingReason of matchingReasons) {
      expect(expectedMatchingReasons).toContain(matchingReason);
    }
    expect(matchingPosts.length).toBe(expectedMatchIndecies.length);
  }
});
