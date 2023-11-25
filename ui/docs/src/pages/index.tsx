import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">
          <Translate id="home.slogan">{'The Investment OS for everyone'}</Translate>
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="https://y.ntnl.io">
            <Translate id="home.getStartedButton">{'Launch Now'}</Translate>
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/intro">
            <Translate id="home.readTheDocsButton">{'Read The Docs'}</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={translate({ message: 'home.welcomeTitle' }, { value: siteConfig.title })}
      description="Description will go into a meta tag in <head />"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
