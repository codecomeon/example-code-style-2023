/**
 * 小程序中的简易海报绘制
 * - Taro框架
 * - 小程序原生Canvas接口
 * - 对文本换行做了简单的计算
 */

import { useCallback, useEffect, useState } from 'react';
import Taro, { createCanvasContext } from '@tarojs/taro';

import { Canvas, View } from '@tarojs/components';
import { Button, Icon, Image, Overlay, Popup, Radio, RadioGroup } from '@antmjs/vantui';

import Poster from '@/components/Poster';
import { PriceType } from '@/constants/common';
import { getIsDebug } from '@/helpers/debug';
import { getPrice } from '@/helpers/number';
import { getShareScene } from '@/helpers/share';
import { getSkuMainImage, getSkuPrice } from '@/helpers/sku';
import { getFullUrl } from '@/helpers/url';
import { getAvatar } from '@/helpers/user';
import { getQrcode } from '@/services/platform';

import downloadCircleIcon from '@/assets/icon/downloadCircle.png';

import './SharePoster.less';

type ShareTypeEnum = 'product' | 'shop';

type SharePosterProps = {
  show: boolean;
  onShowChange?: (isShow: boolean) => void;
  info?: any;
  type?: ShareTypeEnum;
};

export default (props: SharePosterProps) => {
  const { show, onShowChange, type = 'product', info = {} } = props;
  const [settingShow, setSettingShow] = useState(false);
  const [posterImageShow, setPosterImageShow] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>('toB');
  const [posterImage, setPosterImage] = useState('');
  const [posterOptions, setPosterOptions] = useState<any>(null);

  const onClickSave = useCallback(async () => {
    Taro.saveImageToPhotosAlbum({
      filePath: posterImage,
      success: () =>
        Taro.showToast({
          title: '已保存到相册，快去分享吧~',
          icon: 'none',
        }),
      fail: () =>
        Taro.showToast({
          title: '保存失败，请检查权限设置',
        }),
    });
  }, [posterImage]);

  // Base64格式的图片
  const getQrCodeInfo = useCallback(async () => {
    let page = '';
    let id = '';
    if (type === 'product') {
      page = 'pages/car/index';
      id = info.skuId;
    }

    if (type === 'shop') {
      page = 'pages/shop/index';
      id = info.shopId;
    }

    const qrCodeData = {
      page,
      scene: getShareScene(id, priceType),
    };

    const res = await getQrcode({
      ...qrCodeData,
      env_version: !getIsDebug() ? 'release' : 'trial',
      is_hyaline: true,
    });

    return res.buffer.replace(/data:image\/jpeg;base64,|data:image\/png;base64,/, '');
  }, [info, priceType]);

  const initPoster = useCallback(async () => {
    Taro.showLoading({
      title: '海报生成中',
      mask: true,
    });
    const qrCode = await getQrCodeInfo();
    let posterData: any = {};
    if (type === 'product') {
      posterData = {
        image: getSkuMainImage(info),
        name: info.skuName,
        price1: getSkuPrice(info, priceType),
        price2: getPrice(info.priceFee),
        shopLogo: getFullUrl(info.shopLogo),
        shopName: info.shopName,
      };
    }

    if (type === 'shop') {
      posterData = {
        name: info.shopName,
        image: getFullUrl(info.shopLogo),
      };
    }

    posterData.qrCode = qrCode;

    const options = await getPosterOptions(type, posterData);

    setPosterOptions(options);
  }, [info, type, getQrCodeInfo]);

  const onClickInitPoster = () => {
    // 如果有海报了，直接显示海报
    if (posterImage) {
      setSettingShow(false);
      setPosterImageShow(true);
    } else {
      initPoster();
    }
  };

  const getPosterOptions = async (mode: ShareTypeEnum, data) => {
    let avatar = getFullUrl(getAvatar());
    let avatarUrlType = 0;

    if (!avatar) {
      // 默认头像为base64
      avatar =
        'iVBORw0KGgoAAAANSUhEUgAAAEcAAABHCAYAAABVsFofAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFw2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4xLWMwMDAgNzkuZWRhMmIzZmFjLCAyMDIxLzExLzE3LTE3OjIzOjE5ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjMuMSAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjItMTItMDNUMTk6MTE6MDcrMDg6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIyLTEyLTAzVDE5OjE3OjQ5KzA4OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIyLTEyLTAzVDE5OjE3OjQ5KzA4OjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpkZjVkN2E1MS1kM2I5LTQyZDQtYTI4MC05OTY1NzcyY2Y5ZGMiIHhtcE1NOkRvY3VtZW50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';
      avatarUrlType = 1;
    }

    if (mode === 'product') {
      // 测量文本，超过一行就换行
      const ctx = createCanvasContext('measureCanvas');

      const singleLineWidth = 164.1;
      let title = data.name;
      let subTitle = '';
      let subLength = 0;
      let offsetY = 0;
      let px = ctx.measureText(title).width;

      while (true) {
        if (px > singleLineWidth) {
          subLength++;
          const shortTitle = title.substring(0, title.length - subLength);
          px = ctx.measureText(shortTitle).width;
        } else {
          break;
        }
      }

      if (subLength > 0) {
        data.name = title.substring(0, title.length - subLength);
        subTitle = title.substring(title.length - subLength, title.length);
        offsetY = 40;
      }

      const options = {
        width: '595px',
        height: '799px',
        opacity: 0,
        list: [
          {
            type: 'shape',
            shapeType: 0,
            width: 595,
            height: 799,
            color: '#fff',
            X: 0,
            Y: 0,
          },
          {
            type: 'text',
            text: data.name,
            fontSize: '32',
            color: '#333',
            X: 37,
            Y: 380,
          },
          {
            type: 'text',
            text: data.price1,
            fontSize: '34',
            color: '#F31616',
            X: 37,
            Y: 436 + offsetY,
          },
          {
            type: 'text',
            text: '指导价：' + data.price2,
            fontSize: '24',
            color: '#666',
            X: 186,
            Y: 439 + offsetY,
          },
          {
            type: 'image',
            imgType: 1, // 图片类型，圆形1，矩形0
            urlType: 0, // 2:本地路径 或者网络路径:0 base64 1
            url: data.shopLogo,
            width: 97,
            height: 97,
            roundX: 67,
            roundY: 641,
            roundR: 50,
          },
          {
            type: 'text',
            text: data.shopName,
            fontSize: '28',
            color: '#333',
            X: 152,
            Y: 630,
          },
          {
            type: 'text',
            text: '扫码进店有惊喜',
            fontSize: '24',
            color: '#888',
            X: 154,
            Y: 671,
          },
          // 小程序码
          {
            type: 'image',
            imgType: 0, // 图片类型，圆形1，矩形0
            urlType: 1, // 2:本地路径 或者网络路径:0 base64 1
            url: data.qrCode,
            width: 210,
            height: 210,
            X: 355,
            Y: 549,
          },
          {
            type: 'image',
            imgType: 1, // 图片类型，圆形1，矩形0
            urlType: avatarUrlType, // 2:本地路径 或者网络路径:0 base64 1
            url: avatar,
            roundX: 460,
            roundY: 656,
            roundR: 45,
          },
        ],
      };

      if (data.image) {
        // 处理图片为contain模式
        let { width, height } = await Taro.getImageInfo({
          src: data.image,
        });

        const containerWidth = 536;
        const containerHeight = 300;
        const containerRatio = containerWidth / containerHeight;

        const imageRatio = width / height;
        let imageOffsetX = 0;
        let imageOffsetY = 0;

        if (imageRatio > containerRatio) {
          // 较宽的，以宽为准
          width = containerWidth;
          height = containerWidth / imageRatio;
          imageOffsetY = (containerHeight - height) / 2;
        } else {
          height = containerHeight;
          width = containerHeight * imageRatio;
          imageOffsetX = (containerWidth - width) / 2;
        }

        options.list.push({
          type: 'image',
          imgType: 0, // 图片类型，圆形1，矩形0
          urlType: 0, // 2:本地路径 或者网络路径:0 base64 1
          url: data.image,
          width,
          height,
          X: 29 + imageOffsetX,
          Y: 37 + imageOffsetY,
        });
      }

      if (subTitle) {
        options.list.push({
          type: 'text',
          text: subTitle,
          fontSize: '32',
          color: '#333',
          X: 37,
          Y: 380 + offsetY,
        });
      }

      return options;
    }

    if (mode === 'shop') {
      const options = {
        width: '595px',
        height: '799px',
        opacity: 0,
        list: [
          {
            type: 'shape',
            shapeType: 0,
            width: 595,
            height: 799,
            color: '#fff',
            X: 0,
            Y: 0,
          },
          {
            type: 'text',
            text: data.name,
            fontSize: '34',
            color: '#333',
            X: 196,
            Y: 65,
          },
          {
            type: 'image',
            imgType: 0, // 图片类型，圆形1，矩形0
            urlType: 1, // 2:本地路径 或者网络路径:0 base64 1
            url: data.qrCode,
            width: 210,
            height: 210,
            X: 192,
            Y: 481,
          },
          {
            type: 'image',
            imgType: 1, // 图片类型，圆形1，矩形0
            urlType: avatarUrlType, // 2:本地路径 或者网络路径:0 base64 1
            url: avatar,
            roundX: 297,
            roundY: 588,
            roundR: 45,
          },
        ],
      };

      if (data.image) {
        options.list.push({
          type: 'image',
          imgType: 0, // 图片类型，圆形1，矩形0
          urlType: 0, // 2:本地路径 或者网络路径:0 base64 1
          url: data.image,
          width: 375,
          height: 300,
          X: 109,
          Y: 135,
        });
      }

      return options;
    }

    return {};
  };

  const onGetImage = (path) => {
    Taro.hideLoading();
    setSettingShow(false);
    setPosterImage(path);
    setPosterImageShow(true);
  };

  useEffect(() => {
    if (show) {
      setSettingShow(true);
    }
  }, [show]);

  // 更新价格，则重置海报
  useEffect(() => {
    setPosterOptions(null);
    setPosterImage('');
  }, [priceType]);

  return (
    <>
      <Popup
        position='bottom'
        show={settingShow}
        onClose={() => {
          setSettingShow(false);
          onShowChange?.(false);
        }}
        closeOnClickOverlay
      >
        <View className='share-setting'>
          <View className='share-title'>分享{type === 'product' ? '车型' : '店铺'}</View>
          <View className='share-options'>
            <View className='share-options-tip'>分享页面的价格根据以下的选择进行展示：</View>
            <View className='share-options-item'>
              <RadioGroup
                style='justify-content: flex-between;'
                value={priceType}
                direction='horizontal'
                onChange={(e) => setPriceType(e.detail)}
              >
                <Radio name='toB'>B端价格</Radio>
                <Radio name='toC'>C端价格</Radio>
              </RadioGroup>
            </View>
          </View>
          <View className='share-btn' onClick={onClickInitPoster}>
            <Image className='share-icon' src={downloadCircleIcon} fit='contain' />
            <View>生成海报</View>
          </View>
          <View className='share-action'>
            <Button
              block
              plain
              onClick={() => {
                onShowChange?.(false);
                setSettingShow(false);
              }}
            >
              取消
            </Button>
          </View>
        </View>
      </Popup>
      <Overlay show={posterImageShow}>
        <View className='share-poster-view'>
          <View className='share-poster-image-view'>
            <Image className='share-poster-image' src={posterImage} />
          </View>
          <Button className='share-save-btn' type='primary' onClick={onClickSave}>
            保存海报
          </Button>
          <View style='margin: auto;'>
            <Icon
              name='close'
              size='48rpx'
              color='#fff'
              onClick={() => {
                onShowChange?.(false);
                setPosterImageShow(false);
              }}
            />
          </View>
        </View>
      </Overlay>
      {/* 仅在开始分享且已经有选项，并且没有生成过图片，才开始自动生成 */}
      {show && posterOptions && !posterImage ? (
        <Poster options={posterOptions} onGetImage={onGetImage} />
      ) : null}

      <Canvas canvasId='measureCanvas' style={{ width: 0, height: 0 }} />
    </>
  );
};
