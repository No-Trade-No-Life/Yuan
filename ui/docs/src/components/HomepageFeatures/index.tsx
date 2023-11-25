import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import Translate from '@docusaurus/Translate';

type FeatureItem = {
  title: JSX.Element | string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: <Translate id="home.features.gui.title">{'Powerful Web GUI'}</Translate>,
    Svg: require('@site/static/img/web-gui.svg').default,
    description: (
      <Translate id="home.features.gui.description">
        Out-of-box features. No need to install. Launch with your browser.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.language.title">{'Most Popular Language'}</Translate>,
    Svg: require('@site/static/img/javascript.svg').default,
    description: (
      <Translate id="home.features.language.description">
        Use JavaScript / TypeScript to write your trading strategy. Over 12 million developers also choose it.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.ai-assistant.title">{'AI Assistant'}</Translate>,
    Svg: require('@site/static/img/ai-assistant.svg').default,
    description: (
      <Translate id="home.features.ai-assistant.description">
        Having troubles in coding? AI works for you. You make decision like a boss.
      </Translate>
    ),
  },

  {
    title: <Translate id="home.features.real-world-trading.title">{'Real-world Trading'}</Translate>,
    Svg: require('@site/static/img/real-world-trading.svg').default,
    description: (
      <Translate id="home.features.real-world-trading.description">
        Not only in paper back-testing, but also ready for real-world trading.
      </Translate>
    ),
  },
  {
    title: (
      <Translate id="home.features.unified-trading-interface.title">{'Unified Trading Interface'}</Translate>
    ),
    Svg: require('@site/static/img/unified-trading-interface.svg').default,
    description: (
      <Translate id="home.features.unified-trading-interface.description">
        Connect to different market broker. No need to change code.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.deploy.title">{'Local, cloud...or hybrid!'}</Translate>,
    Svg: require('@site/static/img/cloud-local.svg').default,
    description: (
      <Translate id="home.features.deploy.description">
        No technical kidnapping. Starts with your own computer. Progressively switch to the cloud when you
        need. Keep in streamline and unified experience.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.security-privacy.title">{'Security & Privacy'}</Translate>,
    Svg: require('@site/static/img/security-privacy.svg').default,
    description: (
      <Translate id="home.features.security-privacy.description">
        Your files are stored in your local device. Your secret works are protected by your OS.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.free.title">{'Community Promise'}</Translate>,
    Svg: require('@site/static/img/free.svg').default,
    description: (
      <Translate id="home.features.free.description">
        Come from the open-source community. No worry about if we close this site. The basic features are
        forever free for everyone.
      </Translate>
    ),
  },
  // {
  //   title: <Translate id="home.features.ecosystem.title">{'Extension-first Ecosystem'}</Translate>,
  //   Svg: require('@site/static/img/extensions.svg').default,
  //   description: (
  //     <Translate id="home.features.ecosystem.description">
  //       In Yuan, extensions are treated as first-class citizens. ou can use extensions to add new features,
  //       connect with more markets, and enhance your experience.
  //     </Translate>
  //   ),
  // },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--3')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
