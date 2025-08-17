import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import type { Character } from "./types";
import { defaultCharacters } from "./types";

export const charactersAdapter = createEntityAdapter<Character>()
const initialState = charactersAdapter.getInitialState()

const charactersSlice = createSlice({
  name: 'characters',
  initialState: charactersAdapter.upsertMany(initialState, defaultCharacters),
  reducers: {
    upsertMany: charactersAdapter.upsertMany,
    upsertOne: charactersAdapter.upsertOne,
  },
})
export const charactersActions = charactersSlice.actions
export default charactersSlice.reducer