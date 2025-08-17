import { Component, JSX } from 'solid-js';

interface PageLayoutProps {
  title: string;
  description?: string;
  children: JSX.Element;
}

const PageLayout: Component<PageLayoutProps> = (props) => {
  return (
      <>
      <div id="header-links">
          <a href="https://github.com/wobblybits/expressions" target="_blank" rel="noopener" class="header-link" aria-label="View on GitHub">
            <img src="https://img.shields.io/github/stars/wobblybits/expressions?style=social" alt="GitHub stars" class="star-badge"/>
          </a>
          <div class="rc-scout-wrapper"><div class="rc-scout" data-scout-rendered="true"><p class="rc-scout__text"><a class="rc-scout__link" href="https://www.recurse.com/scout/click?t=62e333ccfa9ade523f73c9755aa46503"><i class="rc-scout__logo"></i></a></p></div></div>
        </div>
      <div class="min-h-screen">
        <main>
          {props.children}
        </main>
      </div>
      </>
  );
};

export default PageLayout; 