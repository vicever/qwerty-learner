import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const AuthorButton = () => {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip defaultOpen>
        <TooltipTrigger>
          <Avatar className="h-8 w-8 shadow-lg" onClick={() => window.open('https://zhanggs.com', '_blank')}>
            <AvatarFallback>K</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent className="cursor-pointer" onClick={() => window.open('https://zhanggs.com', '_blank')}>
          <p>KUKU单词 zhanggs.com</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
