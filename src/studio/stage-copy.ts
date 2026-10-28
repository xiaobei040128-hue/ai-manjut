export const stageCopy = [
 {name:'创作启航',description:'从这里，开启你的第一段故事。',englishName:'Your First Chapter',englishDescription:'Every story starts somewhere. Yours starts here.'},
 {name:'灵感成章',description:'让每一份灵感，续写故事的下一章。',englishName:'The Next Chapter',englishDescription:'Bring fresh ideas to the story unfolding.'},
 {name:'创作新境',description:'探索更多可能，让你的故事走得更远。',englishName:'Beyond the Page',englishDescription:'Explore new possibilities for your next chapter.'},
] as const;
export const stageName = (stage:number) => stageCopy[stage-1]?.name || '创作旅程';
