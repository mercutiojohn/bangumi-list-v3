import axios from 'axios';

export class BangumiService {
  private readonly BANGUMI_API_BASE = 'https://api.bgm.tv/v0';

  async fetchImage(subjectId: string): Promise<string | null> {
    try {
      const imageUrl = `${this.BANGUMI_API_BASE}/subjects/${subjectId}/image?type=large`;
      const response = await axios.get(imageUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
        timeout: 5000,
        headers: {
          'User-Agent':
            'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
          Authorization: `Bearer ${process.env.BANGUMI_API_TOKEN || ''}`,
        },
      });

      const finalImageUrl =
        response.headers.location ||
        'https://lain.bgm.tv/img/no_icon_subject.png';

      // 如果是默认图片，返回null表示无有效图片
      if (finalImageUrl === 'https://lain.bgm.tv/img/no_icon_subject.png') {
        console.log(`[Bangumi] No valid image found for subject ${subjectId}`);
        return null;
      }

      return finalImageUrl;
    } catch (error) {
      console.error(`Failed to fetch image for subject ${subjectId}:`, error);
      return null; // 明确返回null表示获取失败
    }
  }
}

export default new BangumiService();
