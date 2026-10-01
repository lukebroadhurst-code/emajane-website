/* Every word the admin shows, in one place.

   Rules for anything written here:
   - short sentences, plain words, the way you would talk to a friend
   - say what a button does ("Put it on my website"), not what it is called inside the computer
   - never blame the person; say what to do next
   A script (worker/reading.test.mjs) measures how easy these are to read. */

export const T = {
  siteName: 'My website',
  skip: 'Skip to the main part of the page',
  noScript: 'This page cannot show yet. Please ask someone to turn on “JavaScript” in your web browser, then refresh the page.',

  size: { label: 'Writing size', normal: 'Normal', big: 'Big', bigger: 'Biggest' },
  helpButton: 'Need help?',
  backToStart: 'Back to the start',
  close: 'Close',
  closeMessage: 'Close this message',
  loading: 'One moment please…',
  loadFailed: 'Sorry, we could not open this. Please refresh the page.',

  practice: {
    title: 'This is a practice copy',
    text: 'Nothing you do here changes your real website. You can try anything.',
  },

  home: {
    heading: 'What would you like to change?',
    lede: 'Choose one box below. Nothing goes on your website until you press “Put it on my website”.',
    waiting: 'Changes waiting',
    upToDate: 'Up to date',
    lastChanged: (when) => `Last changed ${when}`,
    seeWebsite: 'Look at my website',
    waitingTitle: 'You have changes waiting',
    waitingText: 'They are saved, but they are not on your website yet. Choose a box marked “Changes waiting” to finish.',
  },

  status: {
    clean: 'Nothing is waiting. Everything here is on your website.',
    dirty: 'Your changes are saved. They are not on your website yet.',
  },

  actions: {
    seeHow: 'See how it looks',
    putLive: 'Put it on my website',
    throwAway: 'Throw away my changes',
    throwAwayHelp: 'Forget what I have changed here since I last put something on my website.',
    oldVersion: 'Undo my last change on the website',
    oldVersionHelp: 'Put my website back how it was before the last time I changed it.',
    startAgain: 'Use the original words again',
    startAgainHelp: 'Replace the writing here with the words my website began with.',
    seeWebsite: 'Look at my website',
    undoThis: 'Undo what I just did',
    signInAgain: 'Sign in again',
    refresh: 'Refresh the page',
    putBack: 'Put it back',
  },

  next: {
    title: 'Happy with it?',
    text: 'First look at how it will look. Then put it on your website.',
  },

  preview: {
    title: 'This is how your website will look',
    text: 'Nothing has changed yet. This is only a look.',
    close: 'Close this look',
    frame: 'A look at your website with your changes',
  },

  confirmLive: {
    title: 'Put these changes on your website?',
    text: 'Everyone who visits your website will see them.',
    textPractice: 'This is only a practice, so only this computer will see them.',
    changes: 'What will change:',
    yes: 'Yes, put it on my website',
    no: 'Not yet',
    working: 'Putting it on your website…',
  },

  done: {
    title: 'Done!',
    text: 'Your changes are on your website now. It can take a minute to show for everyone.',
    textPractice: 'This was only a practice, so your real website has not changed.',
  },

  undo: {
    title: 'Undo your last change?',
    text: 'Your website will go back to how it was before the last time you changed it.',
    yes: 'Yes, undo it',
    no: 'No, leave it as it is',
    none: 'There is nothing to undo yet.',
    done: 'Done. Your website is back to how it was before.',
  },

  throwAway: {
    title: 'Throw away your changes?',
    text: 'Your website stays as it is. The changes you made here will be lost.',
    yes: 'Yes, throw them away',
    no: 'No, keep them',
    done: 'Your changes are thrown away.',
  },

  again: {
    title: 'Use the original words again?',
    text: 'The writing here will be replaced with the words your website began with. Your website does not change until you press “Put it on my website”.',
    yes: 'Yes, use the original words',
    no: 'No, keep what I have',
    done: 'The original words are back. They are not on your website yet.',
  },

  problems: {
    title: 'Please look at these boxes',
    text: 'Something needs fixing before this can go on your website.',
    goTo: 'Go to this box',
    offline: 'We could not reach your website. Please check your internet, then try again. Your changes are safe.',
    signedOut: 'You have been signed out. Press the button to sign in again. Your changes are safe.',
    conflict: 'Someone else changed this part of your website while you were working. Your changes are safe. Press the button to see the newest version. Your changes will still be here to check.',
    other: 'Sorry, that did not work. Your changes are safe. Please try again.',
    nothing: 'Nothing has changed, so there is nothing to put on your website.',
  },

  form: {
    needed: 'needed',
    optional: 'if you like',
    lettersLeft: (n) => (n === 1 ? '1 letter left' : `${n} letters left`),
    paste: 'Paste',
    linkHelp: '“Paste” puts in the address you copied. “Try this link” opens the page in a new window, so you can check it. Your writing here stays safe.',
    pasteBlocked: 'We could not paste for you. Click or tap in the box, then press Ctrl and V. On a Mac press Command and V.',
    tryLink: 'Try this link',
    tryFirst: 'Paste a web address first. Then you can try it.',
    findLink: 'How do I find the web address?',
    findLinkSteps: [
      'Open the page you want to link to.',
      'Click on the long address at the very top of the screen. If you are on a phone, tap it.',
      'Press Ctrl and C to copy it. On a Mac press Command and C.',
      'Come back here and click or tap in the box.',
      'Press Ctrl and V to paste it. On a Mac press Command and V.',
    ],
    moveUp: 'Move up',
    moveDown: 'Move down',
    takeAway: 'Take away',
    line: (n) => `Line ${n}`,
    day: 'Day',
    month: 'Month',
    year: 'Year',
    choose: 'Choose',
    thatIs: (text) => `That is ${text}.`,
    notOnCalendar: 'That day is not on the calendar.',
    choosePicture: 'Choose a new picture',
    useFirstPicture: 'Use the first picture',
    removePicture: 'Take the picture away',
    makingPicture: 'Making the picture the right size…',
    pictureReady: 'The picture is ready. Remember to put it on your website.',
    noPicture: 'There is no picture.',
    badPicture: 'That file cannot be used as a picture. Please choose a photo or a picture from your computer or phone.',
    hugePicture: 'That picture is very big. Please choose a smaller one.',
    noRoom: 'There is no room left on this computer for more practice pictures. Go to the first page and press “Clear my practice”, then try again.',
    pictureFailed: 'Sorry, that picture did not work. Please try another one.',
  },

  list: {
    change: 'Change',
    takeOff: 'Take off',
    notNow: 'Not now',
    addToList: 'Add to my list',
    saveChanges: 'Save my changes',
    addedTitle: 'Added to your list.',
    savedTitle: 'Your change is saved.',
    notLiveYet: 'It is not on your website yet.',
    putBackTitle: (name) => `“${name}” is back on your list.`,
    putBackText: 'Nothing has changed on your website.',
    removedTitle: (name) => `“${name}” is taken off your list.`,
    removedText: 'It is still on your website until you press “Put it on my website”.',
    removeTitle: (name) => `Take “${name}” off the list?`,
    removeText: 'You can put it back if you change your mind.',
    removeYes: 'Yes, take it off',
    removeNo: 'No, keep it',
    passed: 'That day has already gone, so it will not show on your website.',
    changeAdded: (x) => `New: ${x}`,
    changeRemoved: (x) => `Taken off: ${x}`,
    changeEdited: (x) => `Changed: ${x}`,
    changeOrder: 'The order has changed',
    changeField: (ask, now) => `Changed: ${/[.?!]$/.test(ask) ? ask : ask + '.'} ${now}`,
    nowSays: (words) => `Now it says “${words}”.`,
    nowEmpty: 'Now it is empty.',
    nowCount: (n) => (n === 1 ? 'Now there is 1.' : `Now there are ${n}.`),
    nowPicture: 'Now it is a different picture.',
    movedTo: (name, pos) => `“${name}” is now number ${pos}.`,
  },

  lists: {
    gatherings: {
      add: 'Add a gathering',
      empty: 'There are no gatherings yet. Press the button above to add one.',
      upcoming: 'Coming up',
      past: 'Days that have gone',
      pastHelp: 'These do not show on your website.',
      soldOut: 'Sold out',
      free: 'Free. No ticket needed.',
      tickets: 'Tickets for sale',
      formNew: 'Add a gathering',
      formEdit: 'Change this gathering',
    },
    shop: {
      add: 'Add something to sell',
      empty: 'Nothing for sale yet. Press the button above to add something.',
      soldOut: 'Sold out',
      onSale: 'On sale',
      soon: 'Coming soon',
      formNew: 'Add something to sell',
      formEdit: 'Change this item',
      everything: 'Your whole shop',
    },
  },

  practiceTools: {
    clear: 'Clear my practice',
    title: 'Clear everything you did in practice?',
    text: 'Your practice changes will be thrown away. This does not change your real website.',
    yes: 'Yes, clear it',
    no: 'No, keep it',
    done: 'Your practice is cleared.',
  },

  signedInAs: (who) => `Signed in as ${who}`,
  welcomeBack: 'Welcome back. Your changes from last time are still here.',
  moreThings: 'More things you can do',
  scrollHint: 'Scroll down to read more.',

  help: {
    title: 'How this works',
    steps: [
      'Choose a box on the first page.',
      'Change what you want. Your changes are saved for you.',
      'Press “See how it looks” to check.',
      'Press “Put it on my website” when you are happy.',
    ],
    safe: 'You cannot break anything. Nothing goes on your website until you press “Put it on my website”.',
    mistake: 'If you make a mistake, press “Undo my last change on the website” at the bottom of the page.',
    support: (text) => `Stuck? ${text}`,
    close: 'Close help',
  },
};
