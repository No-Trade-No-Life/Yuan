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
        Yuan has a powerful browser-native GUI, based on the latest web technologies, to power your journey of
        the quantitative trading.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.language.title">{'Simple language and AI assistant'}</Translate>,
    Svg: require('@site/static/img/javascript.svg').default,
    description: (
      <Translate id="home.features.language.description">
        Writing your trading strategy in Javascript/Typescript, the most popular programming language in the
        world, without concerning the environment setup.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.deploy.title">{'Local, cloud...or hybrid!'}</Translate>,
    Svg: require('@site/static/img/cloud-local.svg').default,
    description: (
      <Translate id="home.features.deploy.description">
        Thanks to the latest we technologies and cloud-native architecture, Yuan can access Yuan on the cloud,
        or your local machine, or even a LOT device such as your smart watch, all connected to the same
        trading network.
      </Translate>
    ),
  },
  {
    title: <Translate id="home.features.ecosystem.title">{'Extension-first Ecosystem'}</Translate>,
    Svg: require('@site/static/img/extensions.svg').default,
    description: (
      <Translate id="home.features.ecosystem.description">
        In Yuan, extensions are treated as first-class citizens. ou can use extensions to add new features,
        connect with more markets, and enhance your experience.
      </Translate>
    ),
  },
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
