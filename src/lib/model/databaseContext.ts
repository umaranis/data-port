import { createContext } from "svelte";
import { DatabaseClass } from "./DatabaseClass.svelte";

export let [getDatabaseContext, setDatabaseContext] =
  createContext<DatabaseClass>();
