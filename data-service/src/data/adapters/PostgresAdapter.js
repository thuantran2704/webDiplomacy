import { IRepository } from "../IRepository.js";
import { NotImplementedError } from "../../errors.js";

/**
 * PostgresAdapter — stub. Throws NotImplementedError for every method.
 * Replace with a real pg implementation when switching providers.
 */
export class PostgresAdapter extends IRepository {
  constructor() {
    super();
    console.warn("[data] PostgresAdapter is a stub — DATA_PROVIDER=postgres is not yet implemented.");
  }
}

// Proxy: intercept every method call and throw NotImplementedError
export default new Proxy(new PostgresAdapter(), {
  get(target, prop) {
    if (typeof target[prop] === "function" && prop !== "constructor") {
      return () => { throw new NotImplementedError(`PostgresAdapter.${prop}`); };
    }
    return target[prop];
  },
});
