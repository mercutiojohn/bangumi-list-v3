import { RssItem } from "bangumi-list-v3-shared";

export interface ParsedRssItem {
  title: string;
  link: string;
  episode?: number;
  subGroup?: string;
  resolution?: string;
  language?: string;
  format?: string;
  source?: string;
  version?: string;
  originalItem: RssItem;
  size?: number;
  magnetLink?: string;
  infoHash?: string;
}

export function parseRssTitle(item: RssItem): ParsedRssItem {
  const result: ParsedRssItem = {
    title: item.title,
    link: '',
    size: item.enclosure?.length ? parseInt(item.enclosure.length) : undefined,
    originalItem: item,
    magnetLink: item.enclosure?.url
      ? `magnet:?xt=urn:btih:${item.enclosure.url.split('/').pop()?.split('.torrent')[0]}&tr=http://t.nyaatracker.com/announce&tr=http://tracker.kamigami.org:2710/announce&tr=http://share.camoe.cn:8080/announce&tr=http://opentracker.acgnx.se/announce&tr=http://anidex.moe:6969/announce&tr=http://t.acg.rip:6699/announce&tr=https://tr.bangumi.moe:9696/announce&tr=udp://tr.bangumi.moe:6969/announce&tr=http://open.acgtracker.com:1096/announce&tr=udp://tracker.opentrackr.org:1337/announce`
      : '',
    infoHash: item.enclosure?.url
      ? item.enclosure.url.split('/').pop() || ''
      : '',
  };

  // 提取集数
  const episodeMatch = item.title.match(/\[(\d{1,2}(?:v\d+)?)\]/);
  if (episodeMatch) {
    const episodeStr = episodeMatch[1];
    const versionMatch = episodeStr.match(/(\d+)v(\d+)/);
    if (versionMatch) {
      result.episode = parseInt(versionMatch[1]);
      result.version = `v${versionMatch[2]}`;
    } else {
      result.episode = parseInt(episodeStr);
    }
  }

  // 提取字幕组/发布组
  const subGroupPatterns = [
    /^\[([^\]]+)\]/,  // 开头的方括号
    /【([^】]+)】/,    // 中文书名号
  ];

  for (const pattern of subGroupPatterns) {
    const match = item.title.match(pattern);
    if (match) {
      result.subGroup = match[1];
      break;
    }
  }

  // 提取分辨率
  const resolutionMatch = item.title.match(/(\d{3,4}[pP])/);
  if (resolutionMatch) {
    result.resolution = resolutionMatch[1].toUpperCase();
  }

  // 提取语言信息
  const languagePatterns = [
    { pattern: /简中|简体中文|CHS/, value: '简中' },
    { pattern: /繁中|繁体中文|CHT/, value: '繁中' },
    { pattern: /简繁|简繁内嵌|简繁日内封/, value: '简繁' },
    { pattern: /简日双语/, value: '简日' },
    { pattern: /繁日双语/, value: '繁日' },
  ];

  for (const { pattern, value } of languagePatterns) {
    if (pattern.test(item.title)) {
      result.language = value;
      break;
    }
  }

  // 提取文件格式
  const formatMatch = item.title.match(/\[(MP4|MKV|AVI)\]/i);
  if (formatMatch) {
    result.format = formatMatch[1].toUpperCase();
  }

  // 提取来源
  const sourcePatterns = [
    { pattern: /WebRip|WEB-DL/, value: 'WEB' },
    { pattern: /BDRip|BD/, value: 'BD' },
    { pattern: /ABEMA/, value: 'ABEMA' },
    { pattern: /Baha/, value: 'Baha' },
    { pattern: /CR/, value: 'CR' },
  ];

  for (const { pattern, value } of sourcePatterns) {
    if (pattern.test(item.title)) {
      result.source = value;
      break;
    }
  }

  return result;
}

export function groupRssItems(items: ParsedRssItem[]) {
  const groups = new Map<string, ParsedRssItem[]>();

  for (const item of items) {
    // 将语言信息也加入分组键中
    const key = `${item.subGroup || 'unknown'}_${item.resolution || 'unknown'}_${item.source || 'unknown'}_${item.language || 'unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    groupKey: key,
    items: items.sort((a, b) => (a.episode || 0) - (b.episode || 0))
  }));
}
