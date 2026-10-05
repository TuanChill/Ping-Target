export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: 'Next.js Template',
  description: 'Very simple Next.js template.',
  navItems: [
    {
      label: 'Home',
      href: '/'
    },
    {
      label: 'Posts',
      href: '/posts'
    }
  ]
};
