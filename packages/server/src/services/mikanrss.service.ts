import axios, { AxiosInstance } from 'axios';
import * as xml2js from 'xml2js';
import { RssContent } from './cache.service';

const MIKAN_URL_BASE = 'https://mikanani.me';

export class MikanRssService {
  private readonly maxRetries = Number(process.env.RSS_MAX_RETRIES) || 3;
  private readonly baseDelay = Number(process.env.RSS_BASE_DELAY) || 3000;
  private readonly maxConcurrent = Number(process.env.RSS_MAX_CONCURRENT) || 1;
  private readonly debugLogs = process.env.RSS_DEBUG_LOGS === 'true';
  private activeRequests = 0;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      proxy: process.env.RSS_PROXY_HOST
        ? {
            host: process.env.RSS_PROXY_HOST,
            port: Number(process.env.RSS_PROXY_PORT) || 7890,
            protocol: 'http',
          }
        : undefined,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300,
      withCredentials: false,
    });
  }

  async fetchContent(rssUrl: string): Promise<RssContent | undefined> {
    if (this.debugLogs) console.log('[RSS] fetchContent called with:', rssUrl);

    // 添加输入验证
    if (!rssUrl || typeof rssUrl !== 'string') {
      console.error('[RSS] Invalid rssUrl provided:', rssUrl);
      return undefined;
    }

    // 简单的并发控制
    while (this.activeRequests >= this.maxConcurrent) {
      await this.delay(100);
    }

    this.activeRequests++;
    try {
      return await this.performRequest(rssUrl);
    } catch (error) {
      if (this.debugLogs) {
        console.error('[RSS] Error in fetchContent:', error);
      }
      return undefined;
    } finally {
      this.activeRequests--;
    }
  }

  private async performRequest(
    rssUrl: string
  ): Promise<RssContent | undefined> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (this.debugLogs) {
          console.log(
            `[RSS] Attempt ${attempt}/${this.maxRetries} - Fetching: ${rssUrl}`
          );
        }

        // 从RSS URL中提取bangumiId来构建referrer
        const urlParams = new URLSearchParams(rssUrl.split('?')[1]);
        const bangumiId = urlParams.get('bangumiId');
        const referrer = bangumiId
          ? `${MIKAN_URL_BASE}/Home/Bangumi/${bangumiId}`
          : `${MIKAN_URL_BASE}/`;

        const response = await this.axiosInstance.get(rssUrl, {
          headers: {
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language':
              'zh-HK,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6,en-GB;q=0.5',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            'sec-ch-ua':
              '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
            referer: referrer,
          },
        });

        if (this.debugLogs) {
          console.log(
            `[RSS] Response status: ${response.status}, length: ${
              String(response.data).length
            }`
          );
        }

        // 检查是否是JavaScript重定向页面
        const responseData = String(response.data);
        if (responseData.includes('window.location.replace')) {
          if (this.debugLogs) {
            console.log(
              '[RSS] Detected JavaScript redirect, extracting redirect URL...'
            );
          }

          // 提取重定向URL
          const redirectMatch = responseData.match(
            /window\.location\.replace\('([^']+)'\)/
          );
          if (redirectMatch && redirectMatch[1]) {
            const redirectUrl = redirectMatch[1];
            if (this.debugLogs) {
              console.log(`[RSS] Following redirect to: ${redirectUrl}`);
            }

            // 发起重定向请求
            const redirectResponse = await this.axiosInstance.get(redirectUrl, {
              headers: {
                accept: 'application/rss+xml, application/xml, text/xml',
                'accept-language':
                  'zh-HK,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6,en-GB;q=0.5',
                'cache-control': 'no-cache',
                pragma: 'no-cache',
                'sec-ch-ua':
                  '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
                referer: rssUrl,
              },
            });

            if (this.debugLogs) {
              console.log(
                `[RSS] Redirect response status: ${
                  redirectResponse.status
                }, length: ${String(redirectResponse.data).length}`
              );
            }

            // 检查重定向后的内容是否仍然是HTML
            const redirectData = String(redirectResponse.data);
            if (
              redirectData.includes('<html>') ||
              redirectData.includes('window.location.replace')
            ) {
              console.log('[RSS] Redirect response is still HTML, not RSS XML');
              throw new Error('Redirect response is not RSS XML format');
            }

            // 使用重定向的响应数据
            response.data = redirectResponse.data;
          } else {
            throw new Error('Could not extract redirect URL from JavaScript');
          }
        }

        const parser = new xml2js.Parser({
          explicitArray: false,
          ignoreAttrs: false,
          mergeAttrs: true,
        });

        const result = await parser.parseStringPromise(response.data);

        if (!result.rss || !result.rss.channel) {
          throw new Error('Invalid RSS format');
        }

        const channel = result.rss.channel;
        const items = Array.isArray(channel.item)
          ? channel.item
          : channel.item
          ? [channel.item]
          : [];

        const rssContent: RssContent = {
          title: channel.title || '',
          description: channel.description || '',
          link: channel.link || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: items.map((item: any) => ({
            title: item.title || '',
            description: item.description || '',
            link: item.link || '',
            pubDate: item.pubDate || '',
            guid: item.guid || undefined,
            enclosure: item.enclosure
              ? {
                  url: item.enclosure.url || '',
                  type: item.enclosure.type || '',
                  length: item.enclosure.length || '',
                }
              : undefined,
          })),
        };

        // console.log(
        //   `[RSS] Successfully fetched RSS content: ${rssContent.items.length} items`
        // );
        return rssContent;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        const isLastAttempt = attempt === this.maxRetries;
        const isTimeoutError =
          error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        const isRateLimited = error.response?.status === 429;

        if (this.debugLogs || isLastAttempt) {
          console.warn(`[RSS] Attempt ${attempt} failed for ${rssUrl}:`, {
            error: error.message,
            code: error.code,
            status: error.response?.status,
            isTimeout: isTimeoutError,
            isRateLimited: isRateLimited,
          });
        }

        if (isLastAttempt) {
          console.error(
            `[RSS] Failed to fetch RSS content from ${rssUrl} after ${this.maxRetries} attempts:`,
            {
              message: error.message,
              code: error.code,
              status: error.response?.status,
            }
          );
          return undefined;
        }

        // 对于429错误，使用更长的延迟
        let delay = this.baseDelay * Math.pow(2, attempt - 1);
        if (isRateLimited) {
          delay = delay * 3; // 对于限流错误，延迟3倍时间
          if (this.debugLogs) {
            console.warn(
              `[RSS] Rate limited, waiting ${delay}ms before retry...`
            );
          }
        } else if (isTimeoutError && this.debugLogs) {
          console.warn(`[RSS] Timeout, retrying in ${delay}ms...`);
        } else if (this.debugLogs) {
          console.warn(`[RSS] Error, retrying in ${delay}ms...`);
        }

        await this.delay(delay);
      }
    }

    return undefined;
  }

  private delay(ms: number): Promise<void> {
    if (typeof ms !== 'number' || ms < 0) {
      if (this.debugLogs) {
        console.warn('[RSS] Invalid delay value:', ms);
      }
      ms = 100; // 默认延迟
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getMikanRssUrl(mikanId: string): string {
    if (!mikanId || typeof mikanId !== 'string') {
      console.error('[RSS] Invalid mikanId provided:', mikanId);
      throw new Error('Invalid mikanId provided');
    }
    return `${MIKAN_URL_BASE}/RSS/Bangumi?bangumiId=${mikanId}`;
  }
}

export default new MikanRssService();
