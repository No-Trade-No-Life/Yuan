import { IconFullScreenStroked } from '@douyinfe/semi-icons';
import { Button } from '../Interactive';

export const FullScreenButton = () => {
  return (
    <Button
      theme="borderless"
      type="tertiary"
      icon={<IconFullScreenStroked />}
      onClick={async () => {
        if (document.fullscreenElement) {
          return document.exitFullscreen();
        }
        function enterFullscreen(element: any) {
          if (element.requestFullscreen) {
            return element.requestFullscreen();
          } else if (element.mozRequestFullScreen) {
            // Firefox
            return element.mozRequestFullScreen();
          } else if (element.webkitRequestFullscreen) {
            // Chrome, Safari and Opera
            return element.webkitRequestFullscreen();
          } else if (element.msRequestFullscreen) {
            // IE/Edge
            return element.msRequestFullscreen();
          }
        }
        return enterFullscreen(document.body);

        // return document.body.requestFullscreen();
      }}
    ></Button>
  );
};
