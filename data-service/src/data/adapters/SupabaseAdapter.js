import { IRepository } from "../IRepository.js";
import { NotImplementedError } from "../../errors.js";

/**
 * SupabaseAdapter — stub. Throws NotImplementedError for every method.
 * Replace with @supabase/supabase-js implementation when switching providers.
 */
export class SupabaseAdapter extends IRepository {
  constructor() {
    super();
    console.warn("[data] SupabaseAdapter is a stub — DATA_PROVIDER=supabase is not yet implemented.");
  }
}

export default new Proxy(new SupabaseAdapter(), {
  get(target, prop) {
    if (typeof target[prop] === "function" && prop !== "constructor") {
      return () => { throw new NotImplementedError(`SupabaseAdapter.${prop}`); };
    }
    return target[prop];
  },
});
