export type VerseTheme = "Hope" | "Peace" | "Joy" | "Love";

export type Verse = {
  theme: VerseTheme;
  text: string;
  ref: string;
};

/** World English Bible — public domain. */
export const VERSES: Verse[] = [
  {
    theme: "Hope",
    text: "Now may the God of hope fill you with all joy and peace in believing.",
    ref: "Romans 15:13",
  },
  {
    theme: "Hope",
    text: "Those who wait for Yahweh will renew their strength. They will mount up with wings like eagles.",
    ref: "Isaiah 40:31",
  },
  {
    theme: "Hope",
    text: "For I know the thoughts that I think toward you, says Yahweh… to give you hope and a future.",
    ref: "Jeremiah 29:11",
  },
  {
    theme: "Peace",
    text: "Peace I leave with you. My peace I give to you; not as the world gives, I give to you.",
    ref: "John 14:27",
  },
  {
    theme: "Peace",
    text: "You will keep whoever’s mind is steadfast in perfect peace, because he trusts in you.",
    ref: "Isaiah 26:3",
  },
  {
    theme: "Peace",
    text: "And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.",
    ref: "Philippians 4:7",
  },
  {
    theme: "Joy",
    text: "Don’t be grieved, for the joy of Yahweh is your strength.",
    ref: "Nehemiah 8:10",
  },
  {
    theme: "Joy",
    text: "Weeping may stay for the night, but joy comes in the morning.",
    ref: "Psalm 30:5",
  },
  {
    theme: "Joy",
    text: "In your presence is fullness of joy. In your right hand there are pleasures forever more.",
    ref: "Psalm 16:11",
  },
  {
    theme: "Love",
    text: "But now faith, hope, and love remain—these three. The greatest of these is love.",
    ref: "1 Corinthians 13:13",
  },
  {
    theme: "Love",
    text: "We love him, because he first loved us.",
    ref: "1 John 4:19",
  },
  {
    theme: "Love",
    text: "This is my commandment, that you love one another, even as I have loved you.",
    ref: "John 15:12",
  },
];
