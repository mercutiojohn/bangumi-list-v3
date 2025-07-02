import { Request, Response } from 'express';
import bangumiModel from '../models/bangumi.model';
import { SiteType } from 'bangumi-list-v3-shared';
import moment from 'moment';

export async function update(req: Request, res: Response): Promise<void> {
  try {
    await bangumiModel.update();
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
    return;
  }
  res.sendStatus(201);
}

export async function season(req: Request, res: Response): Promise<void> {
  const version = bangumiModel.version;
  let items = [...bangumiModel.seasons];
  const { start } = req.query;
  const startIndex = items.findIndex((item) => item === start);
  if (startIndex !== -1) {
    items = items.slice(startIndex);
  }

  res.send({
    version,
    items,
  });
}

export async function site(req: Request, res: Response): Promise<void> {
  const { type } = req.query;
  let result = {};
  if (type) {
    result = { ...bangumiModel.siteMap[type as SiteType] };
  } else {
    result = { ...bangumiModel.data?.siteMeta };
  }
  res.send(result);
}

// 添加手动刷新缓存的接口
export async function refreshCache(req: Request, res: Response): Promise<void> {
  try {
    await bangumiModel.triggerCacheRefresh();
    res.send({ message: 'Cache refresh completed successfully' });
  } catch (error) {
    console.error('Manual cache refresh failed:', error);
    res.status(500).send({ error: 'Cache refresh failed' });
  }
}

// 添加获取缓存状态的接口
export async function getCacheStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const failedStatus = bangumiModel.getFailedItemsStatus();
    res.send({
      isRefreshing: bangumiModel.isRefreshingCache,
      failedItems: failedStatus,
    });
  } catch (error) {
    console.error('Failed to get cache status:', error);
    res.status(500).send({ error: 'Failed to get cache status' });
  }
}

export async function getArchive(req: Request, res: Response): Promise<void> {
  const { season } = req.params;
  const { seasonIds, itemEntities } = bangumiModel;
  if (!seasonIds[season]) {
    res.send({ items: [] });
    return;
  }

  const items = seasonIds[season].map((id) => itemEntities[id]);
  // 现在只从缓存获取数据，不进行实时API调用
  const enrichedItems = await bangumiModel.enrichItemsWithImages(items);

  res.send({
    items: enrichedItems,
  });
}

export async function getOnAir(req: Request, res: Response): Promise<void> {
  const { noEndDateIds, itemEntities } = bangumiModel;
  const now = moment();

  const items = noEndDateIds
    .map((id) => itemEntities[id])
    .filter((item) => {
      const { begin } = item;
      const beginDate = moment(begin);
      return beginDate.isBefore(now);
    });

  // 现在只从缓存获取数据，不进行实时API调用
  const enrichedItems = await bangumiModel.enrichItemsWithImages(items);

  res.send({
    items: enrichedItems,
  });
}

// 添加获取单个番剧缓存状态的接口
export async function getItemCache(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;
    const item = bangumiModel.itemEntities[itemId];

    if (!item) {
      res.status(404).send({ error: 'Item not found' });
      return;
    }

    const cacheStatus = bangumiModel.getItemCacheStatus(item);
    res.send(cacheStatus);
  } catch (error) {
    console.error('Failed to get item cache status:', error);
    res.status(500).send({ error: 'Failed to get item cache status' });
  }
}

// 添加刷新单个番剧缓存的接口
export async function refreshItemCache(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { itemId } = req.params;
    const item = bangumiModel.itemEntities[itemId];

    if (!item) {
      res.status(404).send({ error: 'Item not found' });
      return;
    }

    await bangumiModel.refreshItemCache(item);
    const updatedCacheStatus = bangumiModel.getItemCacheStatus(item);

    res.send({
      message: 'Item cache refreshed successfully',
      cache: updatedCacheStatus,
    });
  } catch (error) {
    console.error('Failed to refresh item cache:', error);
    res.status(500).send({ error: 'Failed to refresh item cache' });
  }
}
