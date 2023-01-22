import * as ko from 'knockout'
import WordListsJson from '../../wordfilesconfigs/wordlists.json'
import { CookieInfo } from '../cookies/CookieInfo'
import { ICookieHandler } from '../cookies/ICookieHandler'
import { MorseCookies } from '../cookies/morseCookies'
import { MorseLessonFileFinder } from '../morseLessonFinder'
import { MorseSettings } from '../settings/settings'
import { GeneralUtils } from '../utils/general'
import { FileOptionsInfo } from './FileOptionsInfo'
import ClassPresets from '../../presets/config.json'
import { MorsePresetSetFileFinder } from '../morsePresetSetFinder'
import { MorsePresetFileFinder } from '../morsePresetFinder'
import { MorseViewModel } from '../morse'
import { SettingsChangeInfo } from '../settings/settingsChangeInfo'
export default class MorseLessonPlugin implements ICookieHandler {
  autoCloseLessonAccordion:ko.Observable<boolean>
  userTarget:ko.Observable<string>
  selectedClass:ko.Observable<string>
  userTargetInitialized:boolean
  selectedClassInitialized:boolean
  letterGroupInitialized:boolean
  displaysInitialized:boolean
  settingsPresetsInitialized:boolean
  letterGroup:ko.Observable<string>
  selectedDisplay:ko.Observable<any>
  wordLists:ko.ObservableArray<FileOptionsInfo>
  morseSettings:MorseSettings
  setText:any
  ifStickySets:ko.Observable<boolean>
  stickySets:ko.Observable<string>
  randomizeLessons:ko.Observable<boolean>
  ifOverrideTime:ko.Observable<boolean>
  overrideMins:ko.Observable<number>
  customGroup:ko.Observable<string>
  ifOverrideMinMax:ko.Observable<boolean>
  trueOverrideMin:ko.Observable<number>
  trueOverrideMax:ko.Observable<number>
  overrideMin:ko.PureComputed<number>
  overrideMax:ko.PureComputed<number>
  syncSize:ko.Observable<boolean>
  getTimeEstimate:any
  classes:ko.Computed<Array<any>>
  userTargets:ko.Computed<Array<any>>
  letterGroups:ko.Computed<Array<any>>
  displays:ko.Computed<Array<any>>
  autoCloseCookieName:string
  settingsPresets:ko.ObservableArray<any>
  selectedSettingsPreset:ko.Observable<any>
  morseViewModel:MorseViewModel
  yourSettingsDummy:any

  constructor (morseSettings:MorseSettings, setTextCallBack:any, timeEstimateCallback:any, morseViewModel:MorseViewModel) {
    MorseCookies.registerHandler(this)
    this.morseViewModel = morseViewModel
    this.yourSettingsDummy = { display: 'Your Settings', filename: 'dummy.json', isDummy: true }
    ko.extenders.classOrLetterGroupChange = (target, option) => {
      target.subscribe((newValue) => {
        this.getSettingsPresets()
      })
      return target
    }

    this.autoCloseCookieName = 'autoCloseLessonAccordian'
    this.morseSettings = morseSettings
    this.autoCloseLessonAccordion = ko.observable(false).extend({ saveCookie: this.autoCloseCookieName } as ko.ObservableExtenderOptions<boolean>)
    this.userTarget = ko.observable('STUDENT')
    this.selectedClass = ko.observable('').extend({ classOrLetterGroupChange: null } as ko.ObservableExtenderOptions<boolean>)
    this.userTargetInitialized = false
    this.selectedClassInitialized = false
    this.letterGroupInitialized = false
    this.displaysInitialized = false
    this.letterGroup = ko.observable('').extend({ classOrLetterGroupChange: null } as ko.ObservableExtenderOptions<boolean>)
    this.selectedDisplay = ko.observable({})
    this.selectedSettingsPreset = ko.observable(this.yourSettingsDummy)
    this.wordLists = ko.observableArray([])
    this.setText = setTextCallBack
    this.getTimeEstimate = timeEstimateCallback
    this.ifStickySets = ko.observable(false)
    this.stickySets = ko.observable('')
    this.randomizeLessons = ko.observable(true)
    this.ifOverrideTime = ko.observable(false)
    this.overrideMins = ko.observable(2)
    this.customGroup = ko.observable('')
    this.ifOverrideMinMax = ko.observable(false)
    this.trueOverrideMin = ko.observable(3)
    this.trueOverrideMax = ko.observable(3)
    this.syncSize = ko.observable(true)
    this.settingsPresets = ko.observableArray([this.yourSettingsDummy])

    this.overrideMin = ko.pureComputed({
      read: () => {
        return this.trueOverrideMin()
      },
      write: (value) => {
        this.trueOverrideMin(value)
        if (this.syncSize()) {
          this.trueOverrideMax(value)
        }
      },
      owner: this
    })

    this.overrideMax = ko.pureComputed({
      read: () => {
        if (!this.syncSize()) {
          return this.trueOverrideMax()
        } else {
          this.trueOverrideMax(this.trueOverrideMin())
          return this.trueOverrideMin()
        }
      },
      write: (value) => {
        if (value >= this.trueOverrideMin()) {
          this.trueOverrideMax(value)
        }
      },
      owner: this
    })

    this.userTargets = ko.computed(() => {
      const targs = []
      this.wordLists().forEach((x) => {
        if (!targs.find((y) => y === x.userTarget)) {
          targs.push(x.userTarget)
        }
      })
      return targs
    }, this)

    this.classes = ko.computed(() => {
      const cls = []
      this.wordLists().forEach((x) => {
        if (!cls.find((y) => y === x.class)) {
          cls.push(x.class)
        }
      })
      return cls
    }, this)

    this.letterGroups = ko.computed(() => {
      this.letterGroupInitialized = false
      this.letterGroup('')
      const lgs = []
      if (this.selectedClass() === '' || this.userTarget() === '') {
        const missing = []
        if (this.selectedClass() === '') {
          missing.push('class')
        }
        if (this.userTarget() === '') {
          missing.push('user')
        }
        return [`Select ${missing.join(', ')}`]
      }
      this.wordLists().filter((list) => list.class === this.selectedClass() && list.userTarget === this.userTarget())
        .forEach((x) => {
          if (!lgs.find((y) => y === x.letterGroup)) {
            lgs.push(x.letterGroup)
          }
        })
      return lgs
    }, this)

    this.displays = ko.computed(() => {
      this.displaysInitialized = false
      this.selectedDisplay({})
      const dps = []
      if (this.selectedClass() === '' || this.userTarget() === '' || this.letterGroup() === '') {
        return [{ display: 'Select wordlist', fileName: 'dummy.txt', isDummy: true }]
      }
      this.wordLists().filter((list) => list.class === this.selectedClass() &&
             list.userTarget === this.userTarget() &&
             list.letterGroup === this.letterGroup())
        .forEach((x) => {
          if (!dps.find((y) => y === x.display)) {
            dps.push(x)
          }
        })
      return dps
    }, this)
  }

  // end constructor

  getSettingsPresets = () => {
    const sps = []
    sps.push(this.yourSettingsDummy)
    const handleData = (d) => {
      // console.log(d)
      // console.log(typeof d.data.options)
      if (typeof d.data !== 'undefined' && typeof d.data.options !== 'undefined') {
        this.settingsPresets(sps.concat(d.data.options))
      } else {
        this.settingsPresets(sps)
      }
    }
    if (this.selectedClass() === '') {
      // do nothing
    } else {
      const targetClass = ClassPresets.classes.find(c => c.className === this.selectedClass())
      const targetLesson = targetClass.letterGroups.find(l => l.letterGroup === this.letterGroup())
      if (targetLesson) {
        // sps.push({ display: targetLesson.setFile })
        MorsePresetSetFileFinder.getMorsePresetSetFile(targetLesson.setFile, (data) => handleData(data))
      } else {
        if (targetClass.defaultSetFile) {
          // sps.push({ display: targetClass.defaultSetFile })
          MorsePresetSetFileFinder.getMorsePresetSetFile(targetClass.defaultSetFile, (data) => handleData(data))
        } else {
          // no matches so use default
          this.settingsPresets(sps)
        }
      }
    }
    // this.settingsPresets(sps)
  }

  doCustomGroup = () => {
    if (this.customGroup()) {
      const data = { letters: this.customGroup().trim().replace(/ /g, '') }
      this.randomWordList(data, true)
      this.closeLessonAccordianIfAutoClosing()
    }
  }

  randomWordList = (data, ifCustom) => {
    let str = ''
    const splitWithProsignsAndStcikys = (s) => {
      let stickys = ''
      if (this.ifStickySets() && this.stickySets().trim()) {
        stickys = '|' + this.stickySets().toUpperCase().trim().replace(/ {2}/g, ' ').replace(/ /g, '|')
      }

      const regStr = `<.*?>${stickys}|[^<.*?>]|\\W`
      // console.log(regStr)
      const re = new RegExp(regStr, 'g')
      const match = s.toUpperCase().match(re)
      // console.log(match)
      return match
    }
    const chars = splitWithProsignsAndStcikys(data.letters)
    let seconds = 0
    const controlTime = (this.ifOverrideTime() || ifCustom) ? (this.overrideMins() * 60) : data.practiceSeconds
    const minWordSize = (this.ifOverrideMinMax() || ifCustom) ? this.overrideMin() : data.minWordSize
    const maxWordSize = (this.ifOverrideMinMax() || ifCustom) ? this.overrideMax() : data.maxWordSize
    // Fn to generate random number min/max inclusive
    // https://www.geeksforgeeks.org/how-to-generate-random-number-in-given-range-using-javascript/
    const randomNumber = (min, max) => {
      min = Math.ceil(min)
      max = Math.floor(max)
      return Math.floor(Math.random() * (max - min + 1)) + min
    }

    do {
      let word = ''

      if (this.randomizeLessons()) {
        // determine word length
        const wordLength = minWordSize === maxWordSize ? minWordSize : randomNumber(minWordSize, maxWordSize)

        for (let j = 1; j <= wordLength; j++) { // for each letter
          // determine the letter
          word += chars[randomNumber(1, chars.length) - 1]
        }
      } else {
        word = data.letters
      }

      str += seconds > 0 ? (' ' + word.toUpperCase()) : word.toUpperCase()

      const est = this.getTimeEstimate(str)
      seconds = est.timeCalcs.totalTime / 1000
    } while (seconds < controlTime)

    this.setText(str)
  }

  getWordList = (filename) => {
    const isText = filename.endsWith('txt')

    const afterFound = (result) => {
      if (result.found) {
        if (isText) {
          this.setText(result.data)
        } else {
          this.randomWordList(result.data, false)
        }
      } else {
        this.setText(`ERROR: Couldn't find ${filename} or it lacks .txt or .json extension.`)
      }
    }

    MorseLessonFileFinder.getMorseLessonFile(filename, afterFound)
  }

  setUserTargetInitialized = () => {
    this.userTargetInitialized = true
  }

  setSelectedClassInitialized = () => {
    this.selectedClassInitialized = true
  }

  setLetterGroupInitialized = () => {
    // console.log('setlettergroupinitialized')
    this.letterGroupInitialized = true
  }

  setDisplaysInitialized = () => {
    this.displaysInitialized = true
  }

  setSettingsPresetsInitialized = () => {
    this.settingsPresetsInitialized = true
  }

  changeUserTarget = (userTarget) => {
    if (this.userTargetInitialized) {
      this.userTarget(userTarget)
      // console.log('usertarget')
    }
  }

  changeSelectedClass = (selectedClass) => {
    if (this.selectedClassInitialized) {
      this.selectedClass(selectedClass)
      // console.log(selectedClass)
      // console.log(ClassPresets)
    }
  }

  setLetterGroup = (letterGroup) => {
    if (this.letterGroupInitialized) {
      // console.log('setlettergroup')
      this.letterGroup(letterGroup)
    }
  }

  closeLessonAccordianIfAutoClosing = () => {
    if (this.autoCloseLessonAccordion()) {
      const elem = document.getElementById('lessonAccordianButton')
      elem.click()
    }
  }

  setDisplaySelected = (display) => {
    if (!display.isDummy) {
      if (this.displaysInitialized) {
        this.selectedDisplay(display)
        this.morseSettings.misc.newlineChunking(display.newlineChunking)
        // setText(`when we have lesson files, load ${selectedDisplay().fileName}`)
        this.getWordList(this.selectedDisplay().fileName)
        this.closeLessonAccordianIfAutoClosing()
      }
    }
  }

  setPresetSelected = (preset) => {
    if (this.settingsPresetsInitialized) {
      this.selectedSettingsPreset(preset)
      const settingsInfo = new SettingsChangeInfo(this.morseViewModel)
      settingsInfo.ifLoadSettings = true
      settingsInfo.ignoreCookies = true
      settingsInfo.lockoutCookieChanges = true
      settingsInfo.keyBlacklist = ['ditFrequency', 'dahFrequency', 'syncFreq']

      if (typeof preset.isDummy !== 'undefined' && preset.isDummy) {
        // restore whatever the defaults are

        if (this.morseViewModel.currentSerializedSettings) {
          settingsInfo.custom = this.morseViewModel.currentSerializedSettings.morseSettings

          MorseCookies.loadCookiesOrDefaults(settingsInfo)
        }
      } else {
        MorsePresetFileFinder.getMorsePresetFile(preset.filename, (d) => {
          if (d.found) {
            /* did this filter before keyBlacklist feature was added... */
            settingsInfo.custom = d.data.morseSettings.filter(f => f.key !== 'showRaw')
            MorseCookies.loadCookiesOrDefaults(settingsInfo)
          }
        })
      }

      // give time for settings to change, then re-init the lesson
      if (this.morseViewModel.lessons.selectedDisplay().display && !this.morseViewModel.lessons.selectedDisplay().isDummy) {
        setTimeout(() => { this.morseViewModel.lessons.setDisplaySelected(this.morseViewModel.lessons.selectedDisplay()) }
          , 1000)
      }
    }
  }

  initializeWordList = () => {
    this.wordLists(WordListsJson.fileOptions)
  }

  // cookie handling
  handleCookies = (cookies: Array<CookieInfo>) => {
    if (!cookies) {
      return
    }
    let target:CookieInfo = cookies.find(x => x.key === this.autoCloseCookieName)
    if (target) {
      this.autoCloseLessonAccordion(GeneralUtils.booleanize(target.val))
    }
    target = cookies.find(x => x.key === 'stickySets')
    if (target) {
      this.stickySets(GeneralUtils.booleanize(target.val))
    }
    target = cookies.find(x => x.key === 'ifStickySets')
    if (target) {
      this.ifStickySets(GeneralUtils.booleanize(target.val))
    }
    target = cookies.find(x => x.key === 'customGroup')
    if (target) {
      this.customGroup(target.val)
    }
    target = cookies.find(x => x.key === 'overrideSize')
    if (target) {
      this.ifOverrideMinMax(GeneralUtils.booleanize(target.val))
    }
    target = cookies.find(x => x.key === 'overrideSizeMin')
    if (target) {
      this.overrideMin(target.val as unknown as number)
    }
    target = cookies.find(x => x.key === 'overrideSizeMax')
    if (target) {
      this.overrideMax(target.val as unknown as number)
    }
    target = cookies.find(x => x.key === 'syncSize')
    if (target) {
      this.syncSize(GeneralUtils.booleanize(target.val))
    }
  }

  handleCookie = (cookie: string) => {}
}
