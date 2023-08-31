import { BehaviorSubject } from 'rxjs';

export const isDirty = new BehaviorSubject(false);

window.onbeforeunload = function (e) {
  if (isDirty.value) {
    // Cancel the event
    e.preventDefault();

    // Chrome requires returnValue to be set
    e.returnValue = '?';
  }
};
