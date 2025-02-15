export interface ITwitter {
  type: string;
  id: string;
  url: string;
  twitterUrl: string;
  text: string;
  fullText: string;
  source: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  lang: string;
  quoteId?: string;
  bookmarkCount: number;
  isReply: boolean;
  conversationId: string;
  isPinned: boolean;
  author: Author;
  extendedEntities: ExtendedEntities;
  card: Card;
  place: Place;
  entities: Entities2;
  isRetweet: boolean;
  isQuote: boolean;
  quote?: Quote;
  media: any[];
  isConversationControlled: boolean;
  possiblySensitive?: boolean;
  noResults?: boolean;
}

export interface Author {
  type: string;
  userName: string;
  url: string;
  twitterUrl: string;
  id: string;
  name: string;
  isVerified: boolean;
  isBlueVerified: boolean;
  profilePicture: string;
  coverPicture: string;
  description: string;
  location: string;
  followers: number;
  following: number;
  status: string;
  canDm: boolean;
  canMediaTag: boolean;
  createdAt: string;
  entities: Entities;
  fastFollowersCount: number;
  favouritesCount: number;
  hasCustomTimelines: boolean;
  isTranslator: boolean;
  mediaCount: number;
  statusesCount: number;
  withheldInCountries: any[];
  affiliatesHighlightedLabel: AffiliatesHighlightedLabel;
  possiblySensitive: boolean;
  pinnedTweetIds: any[];
}

export interface Entities {
  description: Description;
  url: Url;
}

export interface Description {
  urls: any[];
}

export interface Url {
  urls: Url2[];
}

export interface Url2 {
  display_url: string;
  expanded_url: string;
  url: string;
  indices: number[];
}

export interface AffiliatesHighlightedLabel {}

export interface ExtendedEntities {}

export interface Card {}

export interface Place {}

export interface Entities2 {
  hashtags: any[];
  symbols: any[];
  timestamps: any[];
  urls: Url3[];
  user_mentions: UserMention[];
}

export interface Url3 {
  display_url: string;
  expanded_url: string;
  url: string;
  indices: number[];
}

export interface UserMention {
  id_str: string;
  name: string;
  screen_name: string;
  indices: number[];
}

export interface Quote {
  type: string;
  id: string;
  text: string;
  source: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  lang: string;
  bookmarkCount: number;
  isPinned: boolean;
  author: Author2;
  extendedEntities: ExtendedEntities2;
  card: Card2;
  place: Place2;
  entities: Entities4;
}

export interface Author2 {
  type: string;
  userName: string;
  url: string;
  twitterUrl: string;
  id: string;
  name: string;
  isVerified: boolean;
  isBlueVerified: boolean;
  profilePicture: string;
  coverPicture: string;
  description: string;
  location: string;
  followers: number;
  following: number;
  status: string;
  canDm: boolean;
  canMediaTag: boolean;
  createdAt: string;
  entities: Entities3;
  fastFollowersCount: number;
  favouritesCount: number;
  hasCustomTimelines: boolean;
  isTranslator: boolean;
  mediaCount: number;
  statusesCount: number;
  withheldInCountries: any[];
  affiliatesHighlightedLabel: AffiliatesHighlightedLabel2;
  possiblySensitive: boolean;
  pinnedTweetIds: string[];
}

export interface Entities3 {
  description: Description2;
  url: Url4;
}

export interface Description2 {
  urls: any[];
}

export interface Url4 {
  urls: Url5[];
}

export interface Url5 {
  display_url: string;
  expanded_url: string;
  url: string;
  indices: number[];
}

export interface AffiliatesHighlightedLabel2 {
  label: Label;
}

export interface Label {
  url: Url6;
  badge: Badge;
  description: string;
  userLabelType: string;
  userLabelDisplayType: string;
}

export interface Url6 {
  url: string;
  urlType: string;
}

export interface Badge {
  url: string;
}

export interface ExtendedEntities2 {}

export interface Card2 {}

export interface Place2 {}

export interface Entities4 {
  hashtags: any[];
  symbols: any[];
  timestamps: any[];
  urls: any[];
  user_mentions: UserMention2[];
}

export interface UserMention2 {
  id_str: string;
  name: string;
  screen_name: string;
  indices: number[];
}
