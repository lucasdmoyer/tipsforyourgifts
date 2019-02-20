export class Consultation {
    constructor(
        public id: number,
        public name: string,
        public request: string,
        public budget: string,
        public ocasion: string,
        public email: string,
        public emaillist: boolean
    ) {}
}
