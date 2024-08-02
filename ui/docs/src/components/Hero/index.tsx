import React from 'react';
import Translate from '@docusaurus/Translate';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';
const HeroContent = () => {
  return (
    <div className={styles.heroBanner}>
      <div className={styles.heroContent}>
        <div className={styles.hero}>
          <Translate id="home.heroTitle">{'Yuan - Personal Investment OS'}</Translate>
        </div>
        <div className={styles.heroSubTitle}>
          <Translate id="home.heroSubTitle">{'The investment OS sfor everyone'}</Translate>
        </div>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="https://y.ntnl.io">
            <Translate id="home.getStartedButton">{'Launch Now'}</Translate>
          </Link>
        </div>
      </div>

      <iframe
        className={styles.iframe}
        width="560"
        height="315"
        src="https://www.youtube.com/embed/RR74o1uojVo?si=jaiqj7VDpxFyTai&autoplay=1&mute=1&loop=1&playlist=RR74o1uojVo"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; loop"
      ></iframe>
    </div>
  );
};
export default HeroContent;
