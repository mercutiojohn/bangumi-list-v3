import axios from 'axios';

export interface BilibiliMediaResponse {
  code: number;
  message: string;
  result: {
    media: {
      areas: Array<{
        id: number;
        name: string;
      }>;
      cover: string;
      horizontal_picture: string;
      media_id: number;
      new_ep: {
        id: number;
        index: string;
        index_show: string;
      };
      rating: {
        count: number;
        score: number;
      };
      season_id: number;
      share_url: string;
      title: string;
      type: number;
      type_name: string;
    };
  };
}

export interface BiliplusResponse {
  code: number;
  message: string;
  result: {
    season_id: number;
    season_title: string;
    section: Array<{
      attr: number;
      episode_id: number;
      episode_ids: number[];
      episodes: Array<{
        bvid: string;
        [key: string]: any;
      }>;
      id: number;
      title: string;
      type: number;
      type2: number;
    }>;
  };
}

export class BilibiliService {
  private readonly BILIBILI_API_BASE = 'https://api.bilibili.com';
  private readonly BILIPLUS_API_BASE = 'https://www.biliplus.com/api/bangumi';

  async fetchSeasonId(mediaId: string): Promise<number | null> {
    try {
      const response = await axios.get<BilibiliMediaResponse>(
        `${this.BILIBILI_API_BASE}/pgc/review/user?media_id=${mediaId}`,
        {
          timeout: 5000,
          headers: {
            'User-Agent':
              'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
          },
        }
      );

      if (response.data.code === 0 && response.data.result?.media?.season_id) {
        return response.data.result.media.season_id;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch season_id for media ${mediaId}:`, error);
      return null;
    }
  }

  async fetchPvBvid(seasonId: number): Promise<string | null> {
    try {
      const response = await axios.get<BiliplusResponse>(
        `${this.BILIPLUS_API_BASE}?season=${seasonId}`,
        {
          timeout: 5000,
          headers: {
            'User-Agent':
              'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
          },
        }
      );

      if (response.data.code === 0 && response.data.result?.section) {
        const pvSection = response.data.result.section.find((section) =>
          section.title.includes('PV')
        );

        if (pvSection?.episodes?.[0]?.bvid) {
          return pvSection.episodes[0].bvid;
        }
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch PV bvid for season ${seasonId}:`, error);
      return null;
    }
  }
}

export default new BilibiliService();
