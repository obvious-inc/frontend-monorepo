import { jest, it, expect } from "@jest/globals";

export const test = it;
export const mock = jest.fn;

export const assert = (value) => {
  expect(value).toBeTruthy();
};

export const assertEqual = (v1, v2) => {
  expect(v1).toStrictEqual(v2);
};

export const assertCalled = (mockFn) => expect(mockFn).toHaveBeenCalled();
