export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/upload/index',
    'pages/orders/index',
    'pages/order-detail/index',
    'pages/profile/index',
    'pages/profile-edit/index',
    'pages/model-detail/index',
    'pages/favorites/index',
    'pages/user-profile/index',
    'pages/messages/index',
    'pages/info/index'
  ],
  subpackages: [
    {
      root: 'subpackage-lab',
      pages: ['model-viewer/index']
    }
  ],
  window: {
    navigationStyle: 'custom',
    backgroundColor: '#f6f7f9',
    backgroundTextStyle: 'dark'
  },
  style: 'v2',
  renderer: 'skyline',
  rendererOptions: {
    skyline: {
      defaultDisplayBlock: true,
      defaultContentBox: true,
      tagNameStyleIsolation: 'legacy',
      disableABTest: true
    }
  },
  componentFramework: 'glass-easel',
  lazyCodeLoading: 'requiredComponents',
  sitemapLocation: 'sitemap.json'
})
