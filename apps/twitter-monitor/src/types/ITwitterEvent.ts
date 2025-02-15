export interface ITwitterEvent {
  id: string;
  //推文内容
  content: string;
  //作者ID
  author_id: string;
  //作者名字
  author: string;
  //作者描述
  author_description: string;
  //作者头像
  author_image: string;
  //作者粉丝
  author_followers: number;

  //推文时间
  created_at: string;

  raw_data: any;
}
